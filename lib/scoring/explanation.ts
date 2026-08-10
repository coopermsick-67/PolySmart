import type { TradeIdea } from "../types";

/** Deterministic, template-based explanation text — no LLM involved. */
export function buildIdeaExplanation(idea: TradeIdea): string {
  const totalWallets = idea.walletsAligned + idea.walletsOpposed;
  const walletClause =
    idea.walletsOpposed > 0
      ? `${idea.walletsAligned} of ${totalWallets} tracked wallets currently hold ${idea.outcome}`
      : `${idea.walletsAligned} tracked wallet${idea.walletsAligned === 1 ? "" : "s"} currently hold${idea.walletsAligned === 1 ? "s" : ""} ${idea.outcome}`;

  const exposureClause = `Their weighted exposure is $${formatUsd(idea.weightedExposure)}.`;

  const currentPct = formatPct(idea.currentProbability);
  const entryPct = formatPct(idea.medianEntryProbability);
  const priceClause = `Current price is ${currentPct}, compared with median observed entry of ${entryPct}.`;

  const riskClause =
    idea.riskFlags.length > 0
      ? `Risk: ${idea.riskFlags.join("; ")}.`
      : "Risk: no elevated risk flags detected.";

  return [walletClause + ".", exposureClause, priceClause, riskClause].join(" ");
}

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatPct(probability: number): string {
  return `${Math.round(probability * 100)}¢`;
}
