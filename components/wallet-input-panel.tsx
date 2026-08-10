"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { dedupeWalletInput, parseWalletInput } from "@/lib/polymarket/wallets";
import { useRecentWalletLists } from "@/lib/hooks/use-recent-wallet-lists";
import { Loader2, Sparkles, Trash2, WandSparkles } from "lucide-react";

export interface AnalyzeParams {
  rawInput: string;
  minValueUsd: number;
  weighting: "quality" | "equal";
}

interface Props {
  isAnalyzing: boolean;
  progress: { loaded: number; total: number } | null;
  onAnalyze: (params: AnalyzeParams) => void;
  onLoadDemo: () => void;
}

export function WalletInputPanel({ isAnalyzing, progress, onAnalyze, onLoadDemo }: Props) {
  const [rawInput, setRawInput] = useState("");
  const [minValueUsd, setMinValueUsd] = useState(100);
  const [weighting, setWeighting] = useState<"quality" | "equal">("quality");
  const { lists, saveList, removeList } = useRecentWalletLists();

  const parsed = useMemo(() => parseWalletInput(rawInput), [rawInput]);

  function handleAnalyze() {
    if (parsed.valid.length === 0) return;
    saveList(rawInput, parsed.valid.length);
    onAnalyze({ rawInput, minValueUsd, weighting });
  }

  function handleDedupe() {
    setRawInput(dedupeWalletInput(rawInput));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-neutral-200">Wallets</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Textarea
          placeholder={"0xabc123... one per line, or comma-separated\n0xdef456..."}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          rows={6}
        />

        {rawInput.trim().length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge>{parsed.valid.length} valid</Badge>
            {parsed.invalid.length > 0 && <Badge variant="danger">{parsed.invalid.length} invalid</Badge>}
            {parsed.duplicates.length > 0 && (
              <>
                <Badge variant="warning">{parsed.duplicates.length} duplicate</Badge>
                <button
                  className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                  onClick={handleDedupe}
                >
                  <WandSparkles className="h-3 w-3" />
                  Remove duplicates
                </button>
              </>
            )}
          </div>
        )}

        {parsed.invalid.length > 0 && (
          <div className="rounded-md border border-red-900/50 bg-red-950/30 p-2 text-xs text-red-300">
            Ignored invalid entries: {parsed.invalid.slice(0, 8).join(", ")}
            {parsed.invalid.length > 8 ? "…" : ""}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500" htmlFor="min-value">
              Min position value ($)
            </label>
            <Input
              id="min-value"
              type="number"
              min={0}
              value={minValueUsd}
              onChange={(e) => setMinValueUsd(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Weighting</label>
            <Select value={weighting} onValueChange={(v) => setWeighting(v as "quality" | "equal")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quality">Wallet quality</SelectItem>
                <SelectItem value="equal">Equal weighting</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleAnalyze} disabled={isAnalyzing || parsed.valid.length === 0}>
            {isAnalyzing ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Analyze wallets
          </Button>
          <Button variant="outline" onClick={onLoadDemo} disabled={isAnalyzing}>
            Load demo
          </Button>
          {isAnalyzing && progress && (
            <span className="text-xs text-neutral-400">
              Analyzing {progress.loaded} of {progress.total} wallets…
            </span>
          )}
        </div>

        {lists.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-neutral-800 pt-3">
            <span className="text-xs text-neutral-500">Recent lists</span>
            <div className="flex flex-col gap-1">
              {lists.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
                  <button
                    className="truncate text-left text-neutral-400 hover:text-emerald-400"
                    onClick={() => setRawInput(l.raw)}
                  >
                    {l.walletCount} wallets · {new Date(l.savedAt).toLocaleDateString()}
                  </button>
                  <button
                    aria-label="Remove saved list"
                    className="text-neutral-600 hover:text-red-400"
                    onClick={() => removeList(l.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
