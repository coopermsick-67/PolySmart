import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime, formatUsd } from "@/lib/utils";
import type { AnalysisSummary } from "@/lib/types";

export function SummaryCards({ summary }: { summary: AnalysisSummary }) {
  const cards: { label: string; value: string; hint?: string }[] = [
    { label: "Wallets analyzed", value: `${summary.walletsAnalyzed}` },
    {
      label: "Wallets loaded",
      value: `${summary.walletsLoaded}`,
      hint: summary.walletsFailed > 0 ? `${summary.walletsFailed} failed` : undefined,
    },
    { label: "Active positions", value: `${summary.activePositionsFound}` },
    { label: "Active markets", value: `${summary.activeMarketsFound}` },
    { label: "Consensus ideas", value: `${summary.consensusIdeasFound}` },
    { label: "Tracked exposure", value: formatUsd(summary.totalTrackedExposure, { compact: true }) },
    { label: "Last refreshed", value: formatRelativeTime(new Date(summary.lastRefreshed).getTime() / 1000) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-0">
            <CardTitle>{c.label}</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-semibold tabular-nums text-neutral-100">{c.value}</div>
            {c.hint && <div className="mt-0.5 text-xs text-amber-400">{c.hint}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
