import { fetchWalletActivity, fetchWalletPositions } from "./polymarket/data-api";
import { deriveCategory, deriveSubcategory, fetchMarketsByConditionIds } from "./polymarket/gamma-api";
import { mapWithConcurrencyLimit } from "./polymarket/http";
import { buildLastActivityIndex, normalizePositions } from "./polymarket/normalize";
import { buildTradeIdeas } from "./scoring/consensus";
import { extractRedeemSamples, scoreAllWallets } from "./scoring/wallet-score";
import type {
  AnalyzeRequestOptions,
  AnalyzeResponse,
  NormalizedPosition,
  RedeemSample,
  WalletLoadResult,
} from "./types";

// Raised from 5 alongside the 1000-wallet cap — still well within what a
// public, unauthenticated API can absorb from a single client, but fast
// enough that a 1000-wallet run doesn't take many minutes end to end.
const WALLET_CONCURRENCY_LIMIT = 15;

interface WalletFetchOutcome {
  wallet: string;
  positions: NormalizedPosition[];
  redeems: RedeemSample[];
  result: WalletLoadResult;
}

async function loadWallet(
  wallet: string,
  minValueUsd: number,
): Promise<WalletFetchOutcome> {
  const [positionsSettled, activitySettled] = await Promise.allSettled([
    fetchWalletPositions(wallet),
    fetchWalletActivity(wallet),
  ]);

  if (positionsSettled.status === "rejected") {
    const message =
      positionsSettled.reason instanceof Error
        ? positionsSettled.reason.message
        : String(positionsSettled.reason);
    return {
      wallet,
      positions: [],
      redeems: [],
      result: { wallet, status: "error", error: message, positionCount: 0, filteredPositionCount: 0 },
    };
  }

  const rawPositions = positionsSettled.value;
  const rawActivity = activitySettled.status === "fulfilled" ? activitySettled.value : [];
  const lastActivityIndex = buildLastActivityIndex(rawActivity);
  const redeems = extractRedeemSamples(rawActivity);

  // Gamma enrichment happens in a second pass (batched across all wallets),
  // so normalize now with an empty market map — isActiveMarket / category /
  // liquidity get filled in after the batched Gamma fetch below.
  const { positions } = normalizePositions(
    wallet,
    rawPositions,
    new Map(),
    lastActivityIndex,
    minValueUsd,
  );

  return {
    wallet,
    positions,
    redeems,
    result: {
      wallet,
      status: "ok",
      positionCount: rawPositions.length,
      filteredPositionCount: positions.length,
    },
  };
}

export async function runAnalysis(
  wallets: string[],
  options: AnalyzeRequestOptions,
  onProgress?: (loaded: number, total: number) => void,
): Promise<AnalyzeResponse> {
  const nowSeconds = Date.now() / 1000;

  let loaded = 0;
  const settled = await mapWithConcurrencyLimit(
    wallets,
    WALLET_CONCURRENCY_LIMIT,
    async (wallet) => {
      const outcome = await loadWallet(wallet, options.minValueUsd);
      loaded += 1;
      onProgress?.(loaded, wallets.length);
      return outcome;
    },
  );

  const walletResults: WalletLoadResult[] = [];
  const positionsByWallet = new Map<string, NormalizedPosition[]>();
  const redeemsByWallet = new Map<string, RedeemSample[]>();
  let allPositions: NormalizedPosition[] = [];

  for (const s of settled) {
    if (s.status === "fulfilled") {
      walletResults.push(s.value.result);
      if (s.value.result.status === "ok") {
        positionsByWallet.set(s.value.wallet, s.value.positions);
        redeemsByWallet.set(s.value.wallet, s.value.redeems);
        allPositions = allPositions.concat(s.value.positions);
      }
    } else {
      const message = s.reason instanceof Error ? s.reason.message : String(s.reason);
      walletResults.push({
        wallet: "unknown",
        status: "error",
        error: message,
        positionCount: 0,
        filteredPositionCount: 0,
      });
    }
  }

  // Batched Gamma enrichment (active/closed status, liquidity, spread, volume).
  const conditionIds = Array.from(new Set(allPositions.map((p) => p.conditionId)));
  const marketsByCondition = await fetchMarketsByConditionIds(conditionIds);

  // Re-run normalization now that market metadata is available, so closed
  // markets get excluded and category/liquidity are populated.
  allPositions = [];
  const reNormalizedByWallet = new Map<string, NormalizedPosition[]>();
  for (const [wallet, positions] of positionsByWallet) {
    const enriched = positions
      .map((p) => {
        const market = marketsByCondition.get(p.conditionId);
        if (!market) return p;
        const category = deriveCategory(market) ?? p.category;
        return {
          ...p,
          isActiveMarket: market.active === true && market.closed !== true,
          category,
          subCategory: deriveSubcategory(market, category) ?? p.subCategory,
        };
      })
      .filter((p) => {
        const market = marketsByCondition.get(p.conditionId);
        return !(market && market.closed === true);
      });
    reNormalizedByWallet.set(wallet, enriched);
    allPositions = allPositions.concat(enriched);
  }

  const walletScores = scoreAllWallets(reNormalizedByWallet, redeemsByWallet, nowSeconds);

  const ideas = buildTradeIdeas(
    allPositions,
    walletScores,
    marketsByCondition,
    options,
    nowSeconds,
  );

  const walletsLoaded = walletResults.filter((r) => r.status === "ok").length;
  const totalTrackedExposure = allPositions.reduce((sum, p) => sum + p.currentValue, 0);
  const activeMarketsFound = new Set(allPositions.map((p) => p.conditionId)).size;

  const response: AnalyzeResponse = {
    summary: {
      walletsRequested: wallets.length,
      walletsAnalyzed: wallets.length,
      walletsLoaded,
      walletsFailed: wallets.length - walletsLoaded,
      activePositionsFound: allPositions.length,
      activeMarketsFound,
      consensusIdeasFound: ideas.length,
      totalTrackedExposure: Math.round(totalTrackedExposure * 100) / 100,
      lastRefreshed: new Date().toISOString(),
    },
    ideas,
    walletResults,
    walletScores,
    validationErrors: [],
  };

  return response;
}
