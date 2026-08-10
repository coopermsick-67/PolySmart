"use client";

import { useCallback, useState } from "react";
import { WalletInputPanel, type AnalyzeParams } from "@/components/wallet-input-panel";
import { SummaryCards } from "@/components/summary-cards";
import { ConsensusTable } from "@/components/consensus-table";
import { MarketDetailDrawer } from "@/components/market-detail-drawer";
import { WalletDetailDrawer } from "@/components/wallet-detail-drawer";
import { MethodologyPanel } from "@/components/methodology-panel";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildDemoResponse } from "@/lib/demo-data";
import type { AnalyzeResponse, TradeIdea } from "@/lib/types";
import { RefreshCw } from "lucide-react";

const CACHE_TTL_MS = 60_000;

export function Dashboard() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [lastParams, setLastParams] = useState<AnalyzeParams | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<TradeIdea | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  const runAnalyze = useCallback(async (params: AnalyzeParams, { force = false } = {}) => {
    if (!force && fetchedAt && Date.now() - fetchedAt < CACHE_TTL_MS) return;

    setIsAnalyzing(true);
    setError(null);
    setProgress({ loaded: 0, total: 0 });
    setLastParams(params);

    try {
      const wallets = params.rawInput.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallets, minValueUsd: params.minValueUsd, weighting: params.weighting }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: "Analysis request failed." }));
        throw new Error(body.error ?? "Analysis request failed.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "progress") {
            setProgress({ loaded: event.loaded, total: event.total });
          } else if (event.type === "result") {
            setResult(event.data as AnalyzeResponse);
            setFetchedAt(Date.now());
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed unexpectedly.");
    } finally {
      setIsAnalyzing(false);
      setProgress(null);
    }
  }, [fetchedAt]);

  const handleLoadDemo = useCallback(() => {
    setError(null);
    setLastParams(null);
    const demo = buildDemoResponse({ minValueUsd: 100, weighting: "quality" });
    setResult(demo);
    setFetchedAt(Date.now());
  }, []);

  const handleRefresh = useCallback(() => {
    if (lastParams) runAnalyze(lastParams, { force: true });
  }, [lastParams, runAnalyze]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <WalletInputPanel isAnalyzing={isAnalyzing} progress={progress} onAnalyze={runAnalyze} onLoadDemo={handleLoadDemo} />

        <div className="flex flex-col gap-6">
          {error && <ErrorState message={error} />}
          {isAnalyzing && !result && <LoadingSkeleton />}
          {!isAnalyzing && !result && !error && <EmptyState />}

          {result && (
            <>
              <div className="flex items-center justify-between">
                <SummaryCards summary={result.summary} />
              </div>

              {lastParams && (
                <div>
                  <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isAnalyzing}>
                    <RefreshCw className={isAnalyzing ? "animate-spin" : ""} /> Refresh
                  </Button>
                </div>
              )}

              {result.validationErrors.length > 0 && (
                <div className="rounded-md border border-amber-900/50 bg-amber-950/30 p-3 text-xs text-amber-300">
                  {result.validationErrors.map((e) => <div key={e}>{e}</div>)}
                </div>
              )}

              <Tabs defaultValue="ideas">
                <TabsList>
                  <TabsTrigger value="ideas">Top consensus ideas</TabsTrigger>
                  <TabsTrigger value="wallets">Wallet load status</TabsTrigger>
                  <TabsTrigger value="methodology">Methodology</TabsTrigger>
                </TabsList>

                <TabsContent value="ideas">
                  <ConsensusTable ideas={result.ideas} onSelectIdea={setSelectedIdea} nowSeconds={new Date(result.summary.lastRefreshed).getTime() / 1000} />
                </TabsContent>

                <TabsContent value="wallets">
                  <WalletLoadStatus result={result} />
                </TabsContent>

                <TabsContent value="methodology">
                  <MethodologyPanel />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      <MarketDetailDrawer
        idea={selectedIdea}
        onOpenChange={(open) => !open && setSelectedIdea(null)}
        onSelectWallet={(wallet) => { setSelectedIdea(null); setSelectedWallet(wallet); }}
      />
      <WalletDetailDrawer wallet={selectedWallet} walletScores={result?.walletScores ?? []} ideas={result?.ideas ?? []} onOpenChange={(open) => !open && setSelectedWallet(null)} />
    </div>
  );
}

function WalletLoadStatus({ result }: { result: AnalyzeResponse }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-4">
      {result.walletResults.map((r) => (
        <div key={r.wallet} className="flex items-center justify-between text-sm">
          <span className="font-mono text-neutral-300">{r.wallet}</span>
          {r.status === "ok" ? (
            <span className="text-neutral-500">{r.filteredPositionCount} of {r.positionCount} positions above minimum value</span>
          ) : (
            <span className="text-red-400">{r.error ?? "Failed to load"}</span>
          )}
        </div>
      ))}
    </div>
  );
}
