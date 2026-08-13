"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents, formatUsd } from "@/lib/utils";
import { usePortfolio } from "@/lib/hooks/use-portfolio";
import { summarizePortfolio } from "@/lib/portfolio/calculations";
import { suggestStake } from "@/lib/portfolio/sizing";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import type { Trade } from "@/lib/portfolio/types";
import type { TradeIdea } from "@/lib/types";

/**
 * One-click "log this trade" flow launched from a consensus idea. Prefills
 * the market, outcome, and current price from the idea itself, stores the
 * idea's conditionId so this trade's price can be kept live afterward, and
 * suggests a stake sized off the user's actual available bankroll and this
 * idea's consensus score — never a flat/arbitrary amount.
 */
export function QuickLogTradeDialog({
  idea,
  onOpenChange,
}: {
  idea: TradeIdea | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { portfolio, addTrade } = usePortfolio();
  const summary = useMemo(() => summarizePortfolio(portfolio), [portfolio]);
  const [stakeUsd, setStakeUsd] = useState("");
  const [logged, setLogged] = useState(false);

  const suggestion = idea ? suggestStake(summary.availableBankrollUsd, idea.consensusScore) : null;
  const stakeNum = Number(stakeUsd);
  const canSubmit = idea !== null && Number.isFinite(stakeNum) && stakeNum > 0;
  const exceedsAvailable =
    canSubmit && summary.availableBankrollUsd !== null && stakeNum > summary.availableBankrollUsd;

  function handleOpenChange(open: boolean) {
    if (!open) {
      setStakeUsd("");
      setLogged(false);
    }
    onOpenChange(open);
  }

  function handleSubmit() {
    if (!idea || !canSubmit) return;
    const trade: Trade = {
      id: crypto.randomUUID(),
      marketQuestion: idea.marketQuestion,
      outcome: idea.outcome,
      entryPriceCents: Math.round(idea.currentProbability * 100 * 100) / 100,
      stakeUsd: stakeNum,
      status: "open",
      exitPriceCents: null,
      currentPriceCents: Math.round(idea.currentProbability * 100 * 100) / 100,
      polymarketUrl: idea.polymarketUrl,
      notes: null,
      openedAt: new Date().toISOString(),
      closedAt: null,
      conditionId: idea.conditionId,
      consensusScoreAtEntry: idea.consensusScore,
    };
    addTrade(trade);
    setLogged(true);
  }

  return (
    <Dialog open={idea !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        {idea && (
          <>
            <DialogHeader>
              <DialogTitle>Log this trade</DialogTitle>
              <DialogDescription>
                Adds a manual position to your bankroll tracker. This app never places trades for you —
                only log what you actually bought on Polymarket yourself.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-3">
                <div className="text-sm font-medium text-neutral-200">{idea.marketQuestion}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                  Outcome: <Badge variant="outline">{idea.outcome}</Badge>
                  Current price: {formatCents(idea.currentProbability)}
                  Score: {idea.consensusScore.toFixed(0)}
                </div>
              </div>

              {logged ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-900/50 bg-emerald-950/30 p-3 text-sm text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> Logged. Price will stay live-tracked on the
                  Portfolio page.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-500">Stake ($)</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0.01}
                        step="0.01"
                        autoFocus
                        value={stakeUsd}
                        onChange={(e) => setStakeUsd(e.target.value)}
                        placeholder="100"
                      />
                      {suggestion && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => setStakeUsd(String(suggestion.stakeUsd))}
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Use {formatUsd(suggestion.stakeUsd)}
                        </Button>
                      )}
                    </div>
                    {suggestion ? (
                      <p className="text-xs text-neutral-500">
                        Suggested from your available bankroll ({formatUsd(summary.availableBankrollUsd)}) and
                        this idea&apos;s {idea.consensusScore.toFixed(0)} consensus score — a {suggestion.tier}
                        {" "}risk-tier stake ({(suggestion.bankrollFraction * 100).toFixed(1)}% of available
                        bankroll). Never more than 5% is suggested for any single trade, regardless of score.
                      </p>
                    ) : summary.availableBankrollUsd === null ? (
                      <p className="text-xs text-neutral-500">
                        Set a starting bankroll on the Portfolio page to get a suggested stake size.
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        This idea&apos;s consensus score ({idea.consensusScore.toFixed(0)}) is below the
                        threshold PolySmart sizes stakes against — no suggestion shown.
                      </p>
                    )}
                  </div>

                  {exceedsAvailable && (
                    <div className="flex items-start gap-1.5 rounded-md border border-amber-900/50 bg-amber-950/30 p-2 text-xs text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      This stake ({formatUsd(stakeNum)}) exceeds your available bankroll of{" "}
                      {formatUsd(summary.availableBankrollUsd)}.
                    </div>
                  )}

                  <Button onClick={handleSubmit} disabled={!canSubmit}>
                    Log trade
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
