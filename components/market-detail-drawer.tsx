"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCents, formatPct, formatRelativeTime, formatUsd } from "@/lib/utils";
import { shortenAddress } from "@/lib/polymarket/wallets";
import { buildIdeaExplanation } from "@/lib/scoring/explanation";
import { SignalTierBadge } from "@/components/signal-tier-badge";
import { QuickLogTradeDialog } from "@/components/portfolio/quick-log-dialog";
import { ExternalLink, NotebookPen } from "lucide-react";
import type { TradeIdea } from "@/lib/types";

export function MarketDetailDrawer({
  idea,
  onOpenChange,
  onSelectWallet,
}: {
  idea: TradeIdea | null;
  onOpenChange: (open: boolean) => void;
  onSelectWallet: (wallet: string) => void;
}) {
  const [quickLogOpen, setQuickLogOpen] = useState(false);

  return (
    <Dialog open={idea !== null} onOpenChange={onOpenChange}>
      <DialogContent widePanel>
        {idea && (
          <>
            <DialogHeader>
              <DialogTitle>{idea.marketQuestion}</DialogTitle>
              <DialogDescription>
                {idea.eventTitle} · Outcome: <span className="text-emerald-400">{idea.outcome}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              <Badge>{idea.confidence} confidence</Badge>
              {idea.category && <Badge variant="outline">{idea.category}</Badge>}
              {idea.riskFlags.map((flag) => (
                <Badge key={flag} variant="danger">
                  {flag}
                </Badge>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Current price" value={formatCents(idea.currentProbability)} />
              <Stat label="Median entry" value={formatCents(idea.medianEntryProbability)} />
              <Stat label="Consensus score" value={idea.consensusScore.toFixed(1)} />
              <Stat label="Weighted exposure" value={formatUsd(idea.weightedExposure)} />
              <Stat label="Unweighted exposure" value={formatUsd(idea.unweightedExposure)} />
              <Stat label="% weight aligned" value={`${idea.pctWeightAligned.toFixed(0)}%`} />
              <Stat
                label="Concentration"
                value={formatPct(idea.concentrationHHI)}
                tone={idea.concentrationHHI >= 0.5 ? "negative" : idea.concentrationHHI >= 0.35 ? "warning" : undefined}
              />
              <Stat label="Liquidity" value={formatUsd(idea.liquidity)} />
              <Stat label="Volume" value={formatUsd(idea.volume, { compact: true })} />
              <Stat label="Last activity" value={formatRelativeTime(idea.lastActivityTs)} />
            </div>

            <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-900/60 p-3 text-sm text-neutral-300">
              {buildIdeaExplanation(idea)}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setQuickLogOpen(true)}>
                <NotebookPen className="h-3.5 w-3.5" /> Log this trade
              </Button>
              {idea.polymarketUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={idea.polymarketUrl} target="_blank" rel="noreferrer">
                    View on Polymarket <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>

            <section className="mt-6">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Aligned wallets ({idea.alignedWallets.length})
              </h4>
              <WalletTable positions={idea.alignedWallets} onSelectWallet={onSelectWallet} />
            </section>

            {idea.opposedWallets.length > 0 && (
              <section className="mt-6">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Opposed wallets ({idea.opposedWallets.length})
                </h4>
                <WalletTable positions={idea.opposedWallets} onSelectWallet={onSelectWallet} />
              </section>
            )}

            <p className="mt-6 text-xs text-neutral-600">
              Not financial advice. Wallet activity may be stale, hedged, or wrong. Do your own research.
            </p>
          </>
        )}
      </DialogContent>
      <QuickLogTradeDialog idea={quickLogOpen ? idea : null} onOpenChange={(open) => !open && setQuickLogOpen(false)} />
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "negative" | "warning";
}) {
  const toneClass =
    tone === "negative" ? "text-red-400" : tone === "warning" ? "text-amber-400" : "text-neutral-100";
  return (
    <div className="rounded-md border border-neutral-800 p-2">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function WalletTable({
  positions,
  onSelectWallet,
}: {
  positions: TradeIdea["alignedWallets"];
  onSelectWallet: (wallet: string) => void;
}) {
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);

  return (
    <div className="rounded-lg border border-neutral-800">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Wallet</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Entry</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Signal</TableHead>
            <TableHead>% of side</TableHead>
            <TableHead>P&amp;L</TableHead>
            <TableHead>Recency</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((p) => {
            const shareOfSide = totalValue > 0 ? p.currentValue / totalValue : 0;
            return (
            <TableRow key={p.wallet}>
              <TableCell>
                <button className="text-emerald-400 hover:underline" onClick={() => onSelectWallet(p.wallet)}>
                  {shortenAddress(p.wallet)}
                </button>
              </TableCell>
              <TableCell className="tabular-nums">{p.sizeShares.toLocaleString()}</TableCell>
              <TableCell className="tabular-nums">{formatCents(p.avgEntryPrice)}</TableCell>
              <TableCell className="tabular-nums">{formatUsd(p.currentValue)}</TableCell>
              <TableCell>
                <SignalTierBadge valueUsd={p.currentValue} />
              </TableCell>
              <TableCell className={`tabular-nums ${shareOfSide >= 0.5 ? "text-amber-400" : "text-neutral-400"}`}>
                {formatPct(shareOfSide)}
              </TableCell>
              <TableCell className={`tabular-nums ${p.cashPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatUsd(p.cashPnl)}
              </TableCell>
              <TableCell className="text-neutral-400">{formatRelativeTime(p.lastActivityTs)}</TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
