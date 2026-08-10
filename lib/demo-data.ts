import { buildTradeIdeas } from "./scoring/consensus";
import { scoreAllWallets } from "./scoring/wallet-score";
import type {
  AnalyzeRequestOptions,
  AnalyzeResponse,
  NormalizedPosition,
  RawGammaMarket,
  RedeemSample,
  WalletLoadResult,
} from "./types";

export const DEMO_WALLETS = [
  "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12",
  "0x2b3c4d5e6f7890abcdef1234567890abcdef1234",
  "0x3c4d5e6f7890abcdef1234567890abcdef123456",
  "0x4d5e6f7890abcdef1234567890abcdef12345678",
  "0x5e6f7890abcdef1234567890abcdef1234567890",
  "0x6f7890abcdef1234567890abcdef123456789012",
];

const NOW = Math.floor(Date.now() / 1000);
const HOUR = 3600;

function pos(overrides: Partial<NormalizedPosition> & Pick<NormalizedPosition, "wallet" | "conditionId" | "outcome" | "outcomeIndex" | "eventTitle" | "marketQuestion">): NormalizedPosition {
  return {
    asset: `${overrides.conditionId}-${overrides.outcomeIndex}`,
    marketSlug: overrides.eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    eventSlug: overrides.eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    currentProbability: 0.5,
    avgEntryPrice: 0.45,
    sizeShares: 1000,
    currentValue: 500,
    cashPnl: 50,
    percentPnl: 10,
    lastActivityTs: NOW - HOUR,
    isActiveMarket: true,
    category: "Politics",
    subCategory: null,
    endDate: new Date((NOW + 30 * 24 * HOUR) * 1000).toISOString(),
    ...overrides,
  };
}

const DEMO_MARKETS: RawGammaMarket[] = [
  {
    id: "1",
    conditionId: "0xcond-fed-rate",
    question: "Will the Fed cut rates in September?",
    slug: "fed-rate-cut-september",
    active: true,
    closed: false,
    liquidity: "48200",
    volume: "1250000",
    spread: "0.01",
    tags: [{ label: "Economy" }, { label: "Fed" }],
  },
  {
    id: "2",
    conditionId: "0xcond-election",
    question: "Will the incumbent party win the special election?",
    slug: "special-election-winner",
    active: true,
    closed: false,
    liquidity: "1800",
    volume: "42000",
    spread: "0.04",
    tags: [{ label: "Politics" }, { label: "Elections" }],
  },
  {
    id: "3",
    conditionId: "0xcond-championship",
    question: "Will the top seed win the championship?",
    slug: "top-seed-championship-winner",
    active: true,
    closed: false,
    liquidity: "9600",
    volume: "310000",
    spread: "0.02",
    tags: [{ label: "Sports" }, { label: "NBA" }],
  },
];

export function buildDemoPositions(): NormalizedPosition[] {
  const [w1, w2, w3, w4, w5, w6] = DEMO_WALLETS;

  return [
    // Fed rate cut — strong aligned consensus (YES), fresh, liquid.
    pos({ wallet: w1, conditionId: "0xcond-fed-rate", outcome: "Yes", outcomeIndex: 0, eventTitle: "Will the Fed cut rates in September?", marketQuestion: "Will the Fed cut rates in September?", currentValue: 4200, avgEntryPrice: 0.58, currentProbability: 0.71, lastActivityTs: NOW - 2 * HOUR, category: "Economy", subCategory: "Fed" }),
    pos({ wallet: w2, conditionId: "0xcond-fed-rate", outcome: "Yes", outcomeIndex: 0, eventTitle: "Will the Fed cut rates in September?", marketQuestion: "Will the Fed cut rates in September?", currentValue: 2600, avgEntryPrice: 0.6, currentProbability: 0.71, lastActivityTs: NOW - 5 * HOUR, category: "Economy", subCategory: "Fed" }),
    pos({ wallet: w3, conditionId: "0xcond-fed-rate", outcome: "Yes", outcomeIndex: 0, eventTitle: "Will the Fed cut rates in September?", marketQuestion: "Will the Fed cut rates in September?", currentValue: 1100, avgEntryPrice: 0.55, currentProbability: 0.71, lastActivityTs: NOW - 12 * HOUR, category: "Economy", subCategory: "Fed" }),
    pos({ wallet: w4, conditionId: "0xcond-fed-rate", outcome: "Yes", outcomeIndex: 0, eventTitle: "Will the Fed cut rates in September?", marketQuestion: "Will the Fed cut rates in September?", currentValue: 900, avgEntryPrice: 0.62, currentProbability: 0.71, lastActivityTs: NOW - 1 * HOUR, category: "Economy", subCategory: "Fed" }),

    // Special election — conflicted market, thin liquidity, only 2 aligned each side.
    pos({ wallet: w1, conditionId: "0xcond-election", outcome: "Yes", outcomeIndex: 0, eventTitle: "Will the incumbent party win the special election?", marketQuestion: "Will the incumbent party win the special election?", currentValue: 300, avgEntryPrice: 0.4, currentProbability: 0.52, lastActivityTs: NOW - 30 * HOUR, category: "Politics" }),
    pos({ wallet: w5, conditionId: "0xcond-election", outcome: "Yes", outcomeIndex: 0, eventTitle: "Will the incumbent party win the special election?", marketQuestion: "Will the incumbent party win the special election?", currentValue: 260, avgEntryPrice: 0.42, currentProbability: 0.52, lastActivityTs: NOW - 40 * HOUR, category: "Politics" }),
    pos({ wallet: w2, conditionId: "0xcond-election", outcome: "No", outcomeIndex: 1, eventTitle: "Will the incumbent party win the special election?", marketQuestion: "Will the incumbent party win the special election?", currentValue: 320, avgEntryPrice: 0.55, currentProbability: 0.48, lastActivityTs: NOW - 20 * HOUR, category: "Politics" }),
    pos({ wallet: w6, conditionId: "0xcond-election", outcome: "No", outcomeIndex: 1, eventTitle: "Will the incumbent party win the special election?", marketQuestion: "Will the incumbent party win the special election?", currentValue: 280, avgEntryPrice: 0.53, currentProbability: 0.48, lastActivityTs: NOW - 8 * HOUR, category: "Politics" }),

    // Championship — moderate consensus, decent liquidity, near resolution.
    pos({ wallet: w3, conditionId: "0xcond-championship", outcome: "Yes", outcomeIndex: 0, eventTitle: "Will the top seed win the championship?", marketQuestion: "Will the top seed win the championship?", currentValue: 1600, avgEntryPrice: 0.66, currentProbability: 0.74, lastActivityTs: NOW - 3 * HOUR, category: "Sports", subCategory: "NBA", endDate: new Date((NOW + 10 * HOUR) * 1000).toISOString() }),
    pos({ wallet: w4, conditionId: "0xcond-championship", outcome: "Yes", outcomeIndex: 0, eventTitle: "Will the top seed win the championship?", marketQuestion: "Will the top seed win the championship?", currentValue: 700, avgEntryPrice: 0.7, currentProbability: 0.74, lastActivityTs: NOW - 6 * HOUR, category: "Sports", subCategory: "NBA", endDate: new Date((NOW + 10 * HOUR) * 1000).toISOString() }),
    pos({ wallet: w6, conditionId: "0xcond-championship", outcome: "Yes", outcomeIndex: 0, eventTitle: "Will the top seed win the championship?", marketQuestion: "Will the top seed win the championship?", currentValue: 450, avgEntryPrice: 0.68, currentProbability: 0.74, lastActivityTs: NOW - 60 * HOUR, category: "Sports", subCategory: "NBA", endDate: new Date((NOW + 10 * HOUR) * 1000).toISOString() }),
  ];
}

export function buildDemoResponse(options: AnalyzeRequestOptions): AnalyzeResponse {
  const positions = buildDemoPositions();
  const marketsByCondition = new Map(DEMO_MARKETS.map((m) => [m.conditionId!, m]));

  const positionsByWallet = new Map<string, NormalizedPosition[]>();
  for (const p of positions) {
    const list = positionsByWallet.get(p.wallet) ?? [];
    list.push(p);
    positionsByWallet.set(p.wallet, list);
  }

  const [w1, w2] = DEMO_WALLETS;
  const redeemsByWallet = new Map<string, RedeemSample[]>([
    // w1 recently redeemed two resolved markets — showcases the realized-signal boost.
    [w1, [
      { timestamp: NOW - 2 * 24 * HOUR, usdcSize: 1200 },
      { timestamp: NOW - 9 * 24 * HOUR, usdcSize: 480 },
    ]],
    [w2, [{ timestamp: NOW - 20 * 24 * HOUR, usdcSize: 150 }]],
  ]);

  const walletScores = scoreAllWallets(positionsByWallet, redeemsByWallet, NOW);
  const ideas = buildTradeIdeas(positions, walletScores, marketsByCondition, options, NOW);

  const walletResults: WalletLoadResult[] = DEMO_WALLETS.map((wallet) => ({
    wallet,
    status: "ok",
    positionCount: positionsByWallet.get(wallet)?.length ?? 0,
    filteredPositionCount: positionsByWallet.get(wallet)?.length ?? 0,
  }));

  const totalTrackedExposure = positions.reduce((sum, p) => sum + p.currentValue, 0);

  return {
    summary: {
      walletsRequested: DEMO_WALLETS.length,
      walletsAnalyzed: DEMO_WALLETS.length,
      walletsLoaded: DEMO_WALLETS.length,
      walletsFailed: 0,
      activePositionsFound: positions.length,
      activeMarketsFound: new Set(positions.map((p) => p.conditionId)).size,
      consensusIdeasFound: ideas.length,
      totalTrackedExposure: Math.round(totalTrackedExposure * 100) / 100,
      lastRefreshed: new Date().toISOString(),
    },
    ideas,
    walletResults,
    walletScores,
    validationErrors: [],
  };
}
