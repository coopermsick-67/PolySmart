"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime, formatUsd } from "@/lib/utils";
import { shortenAddress } from "@/lib/polymarket/wallets";
import { SignalTierBadge } from "@/components/signal-tier-badge";
import { Copy, ExternalLink } from "lucide-react";
import type { TradeIdea, WalletScore } from "@/lib/types";

export function WalletDetailDrawer({
  wallet,
  walletScores,
  ideas,
  onOpenChange,
}: {
  wallet: string | null;
  walletScores: WalletScore[];
  ideas: TradeIdea[];
  onOpenChange: (open: boolean) => void;
}) {
  const score = useMemo(
    () => (wallet ? walletScores.find((w) => w.wallet === wallet) ?? null : null),
    [wallet, walletScores],
  );

  const walletPositions = useMemo(() => {
    if (!wallet) return [];
    return ideas.flatMap((idea) => {
      const aligned = idea.alignedWallets.find((p) => p.wallet === wallet);
      const opposed = idea.opposedWallets.find((p) => p.wallet === wallet);
      const match = aligned ?? opposed;
      if (!match) return [];
      return [{ idea, side: aligned ? idea.outcome : "opposing", position: match }];
    });
  }, [wallet, ideas]);

  const isLowSample = score !== null && score.activeMarketCount < 2;

  return (
    <Dialog open={wallet !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {wallet && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-mono text-base">
                {shortenAddress(wallet, 6)}
                <button
                  className="text-neutral-500 hover:text-neutral-200"
                  onClick={() => navigator.clipboard?.writeText(wallet)}
                  aria-label="Copy wallet address"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </DialogTitle>
              <DialogDescription>Tracked trader wallet</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`https://polymarket.com/profile/${wallet}`} target="_blank" rel="noreferrer">
                  Polymarket profile <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`https://polygonscan.com/address/${wallet}`} target="_blank" rel="noreferrer">
                  Polygonscan <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>

            {score && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Wallet score" value={score.score.toFixed(1)} />
                <Stat label="Active exposure" value={formatUsd(score.activePositionValue)} />
                <Stat label="Active markets" value={`${score.activeMarketCount}`} />
                <Stat label="Last activity" value={formatRelativeTime(score.mostRecentActivityTs)} />
                <Stat label="Recent redemptions" value={`${score.recentRedeemCount}`} />
                <Stat label="Redeemed value" value={formatUsd(score.recentRedeemValue)} />
              </div>
            )}

            {score && score.recentRedeemCount > 0 && (
              <p className="mt-2 text-xs text-neutral-500">
                Redemptions are claimed payouts from resolved markets — a proxy for recent wins,
                since worthless losing shares are rarely worth redeeming.
              </p>
            )}

            {isLowSample && (
              <div className="mt-3 rounded-md border border-amber-900/50 bg-amber-950/30 p-2 text-xs text-amber-300">
                Downweighted: fewer than 2 active markets tracked, so diversification can&apos;t be assessed.
              </div>
            )}

            {score && (
              <p className="mt-3 text-xs text-neutral-500">{score.basisNote}</p>
            )}

            <section className="mt-6">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Current positions ({walletPositions.length})
              </h4>
              <div className="flex flex-col gap-2">
                {walletPositions.map(({ idea, side, position }) => (
                  <div key={idea.id} className="rounded-md border border-neutral-800 p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-neutral-200">{idea.marketQuestion}</span>
                      <Badge variant={side === "opposing" ? "danger" : "outline"}>{idea.outcome}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                      <span>{formatUsd(position.currentValue)}</span>
                      <SignalTierBadge valueUsd={position.currentValue} />
                      <span className={position.cashPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {formatUsd(position.cashPnl)} P&amp;L
                      </span>
                      <span>{formatRelativeTime(position.lastActivityTs)}</span>
                    </div>
                  </div>
                ))}
                {walletPositions.length === 0 && (
                  <p className="text-sm text-neutral-500">No qualifying positions above the minimum value filter.</p>
                )}
              </div>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-800 p-2">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-neutral-100">{value}</div>
    </div>
  );
}
