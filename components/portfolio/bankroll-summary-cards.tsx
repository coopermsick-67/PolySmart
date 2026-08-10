import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPct, formatUsd } from "@/lib/utils";
import type { BankrollSummary } from "@/lib/portfolio/types";

const HIGH_RISK_THRESHOLD = 0.5; // committed stake as a fraction of current bankroll

export function BankrollSummaryCards({ summary }: { summary: BankrollSummary }) {
  const committedFraction =
    summary.currentBankrollUsd && summary.currentBankrollUsd > 0
      ? summary.committedStakeUsd / summary.currentBankrollUsd
      : 0;
  const isHighRisk = committedFraction >= HIGH_RISK_THRESHOLD;

  const cards: { label: string; value: string; tone?: "positive" | "negative" | "warning" }[] = [
    {
      label: "Available bankroll",
      value: formatUsd(summary.availableBankrollUsd),
      tone: summary.availableBankrollUsd !== null && summary.availableBankrollUsd < 0 ? "negative" : undefined,
    },
    { label: "Total account value", value: formatUsd(summary.currentBankrollUsd) },
    {
      label: "Committed (at risk)",
      value: formatUsd(summary.committedStakeUsd),
      tone: isHighRisk ? "warning" : undefined,
    },
    {
      label: "Realized P&L",
      value: formatUsd(summary.realizedPnl),
      tone: summary.realizedPnl >= 0 ? "positive" : "negative",
    },
    {
      label: "Unrealized P&L",
      value: formatUsd(summary.unrealizedPnl),
      tone: summary.unrealizedPnl >= 0 ? "positive" : "negative",
    },
    {
      label: "Win rate",
      value: summary.winRate === null ? "—" : formatPct(summary.winRate),
    },
    { label: "Open / closed", value: `${summary.openTrades} / ${summary.closedTrades}` },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-0">
              <CardTitle>{c.label}</CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <div
                className={`text-xl font-semibold tabular-nums ${
                  c.tone === "positive"
                    ? "text-emerald-400"
                    : c.tone === "negative"
                      ? "text-red-400"
                      : c.tone === "warning"
                        ? "text-amber-400"
                        : "text-neutral-100"
                }`}
              >
                {c.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {summary.availableBankrollUsd !== null && summary.availableBankrollUsd < 0 ? (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 p-2 text-xs text-red-300">
          Your open trades commit more capital than your bankroll covers. Available bankroll is
          negative — double-check your logged stakes.
        </div>
      ) : (
        isHighRisk && (
          <div className="rounded-md border border-amber-900/50 bg-amber-950/30 p-2 text-xs text-amber-300">
            {formatPct(committedFraction)} of your bankroll is currently committed to open trades.
          </div>
        )
      )}
    </div>
  );
}
