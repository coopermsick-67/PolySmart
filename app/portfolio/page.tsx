"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { StartingBankrollCard } from "@/components/portfolio/starting-bankroll-card";
import { BankrollSummaryCards } from "@/components/portfolio/bankroll-summary-cards";
import { TradeForm } from "@/components/portfolio/trade-form";
import { TradeTable } from "@/components/portfolio/trade-table";
import { EquityCurveChart } from "@/components/portfolio/equity-curve-chart";
import { usePortfolio } from "@/lib/hooks/use-portfolio";
import { useLiveTradePrices } from "@/lib/hooks/use-live-prices";
import { buildEquityCurve, summarizePortfolio } from "@/lib/portfolio/calculations";
import { formatRelativeTime } from "@/lib/utils";
import { Radio, RefreshCw, Trash2 } from "lucide-react";

export default function PortfolioPage() {
  const { portfolio, setStartingBankroll, addTrade, updateTrade, deleteTrade, resetPortfolio } =
    usePortfolio();
  const [liveEnabled, setLiveEnabled] = useState(true);

  const summary = useMemo(() => summarizePortfolio(portfolio), [portfolio]);
  const equityCurve = useMemo(() => buildEquityCurve(portfolio), [portfolio]);

  const { lastRefreshedAt, isRefreshing, refresh, trackableCount } = useLiveTradePrices(
    portfolio.trades,
    updateTrade,
    { enabled: liveEnabled },
  );

  function handleReset() {
    if (window.confirm("Clear your starting bankroll and every logged trade? This can't be undone.")) {
      resetPortfolio();
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-neutral-100">Bankroll Tracker</h2>
          <p className="max-w-2xl text-sm text-neutral-500">
            A manual, self-reported log of trades you made on Polymarket yourself — this app never
            connects to a wallet, places, or auto-tracks any trade. Saved entirely in your browser,
            so it stays put regardless of what server is running. Not financial advice.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {trackableCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Radio className={`h-3.5 w-3.5 ${liveEnabled ? "text-emerald-400" : "text-neutral-600"}`} />
              {liveEnabled
                ? `Live-tracking ${trackableCount} open trade${trackableCount === 1 ? "" : "s"}${lastRefreshedAt ? ` · updated ${formatRelativeTime(Math.floor(lastRefreshedAt / 1000))}` : ""}`
                : "Live price tracking paused"}
              <Button variant="ghost" size="sm" onClick={() => refresh()} disabled={!liveEnabled || isRefreshing}>
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLiveEnabled((v) => !v)}>
                {liveEnabled ? "Pause" : "Resume"}
              </Button>
            </div>
          )}
          {(portfolio.startingBankrollUsd !== null || portfolio.trades.length > 0) && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <Trash2 className="h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-6">
          <StartingBankrollCard
            startingBankrollUsd={portfolio.startingBankrollUsd}
            startingBankrollSetAt={portfolio.startingBankrollSetAt}
            onSet={setStartingBankroll}
          />
          <TradeForm onAdd={addTrade} availableBankrollUsd={summary.availableBankrollUsd} />
        </div>

        <div className="flex flex-col gap-6">
          <BankrollSummaryCards summary={summary} />
          <EquityCurveChart points={equityCurve} />
          <TradeTable trades={portfolio.trades} onUpdate={updateTrade} onDelete={deleteTrade} />
        </div>
      </div>
    </div>
  );
}
