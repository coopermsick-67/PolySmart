"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatUsd } from "@/lib/utils";
import { AlertTriangle, PlusCircle } from "lucide-react";
import type { Trade } from "@/lib/portfolio/types";

export function TradeForm({
  onAdd,
  availableBankrollUsd,
}: {
  onAdd: (trade: Trade) => void;
  /** Free cash not already committed to open trades — used to warn on over-staking. Null if no starting bankroll is set. */
  availableBankrollUsd: number | null;
}) {
  const [marketQuestion, setMarketQuestion] = useState("");
  const [outcome, setOutcome] = useState("");
  const [entryPriceCents, setEntryPriceCents] = useState("");
  const [stakeUsd, setStakeUsd] = useState("");
  const [polymarketUrl, setPolymarketUrl] = useState("");
  const [notes, setNotes] = useState("");

  const entryValid = Number(entryPriceCents) > 0 && Number(entryPriceCents) < 100;
  const stakeValid = Number(stakeUsd) > 0;
  const canSubmit = marketQuestion.trim().length > 0 && outcome.trim().length > 0 && entryValid && stakeValid;
  const exceedsAvailable =
    stakeValid && availableBankrollUsd !== null && Number(stakeUsd) > availableBankrollUsd;

  function handleSubmit() {
    if (!canSubmit) return;
    const trade: Trade = {
      id: crypto.randomUUID(),
      marketQuestion: marketQuestion.trim(),
      outcome: outcome.trim(),
      entryPriceCents: Number(entryPriceCents),
      stakeUsd: Number(stakeUsd),
      status: "open",
      exitPriceCents: null,
      currentPriceCents: null,
      polymarketUrl: polymarketUrl.trim() || null,
      notes: notes.trim() || null,
      openedAt: new Date().toISOString(),
      closedAt: null,
    };
    onAdd(trade);
    setMarketQuestion("");
    setOutcome("");
    setEntryPriceCents("");
    setStakeUsd("");
    setPolymarketUrl("");
    setNotes("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-neutral-200">Log a trade</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <FormField label="Market question">
          <Input
            value={marketQuestion}
            onChange={(e) => setMarketQuestion(e.target.value)}
            placeholder="Will the Fed cut rates in September?"
          />
        </FormField>
        <FormField label="Outcome">
          <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Yes" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Entry price (¢)">
            <Input
              type="number"
              min={0.01}
              max={99.99}
              step="0.01"
              value={entryPriceCents}
              onChange={(e) => setEntryPriceCents(e.target.value)}
              placeholder="58"
            />
          </FormField>
          <FormField label="Stake ($)">
            <Input
              type="number"
              min={0.01}
              step="0.01"
              value={stakeUsd}
              onChange={(e) => setStakeUsd(e.target.value)}
              placeholder="100"
            />
          </FormField>
        </div>
        {exceedsAvailable && (
          <div className="flex items-start gap-1.5 rounded-md border border-amber-900/50 bg-amber-950/30 p-2 text-xs text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This stake ({formatUsd(Number(stakeUsd))}) exceeds your available bankroll of{" "}
            {formatUsd(availableBankrollUsd)}. You can still log it if that&apos;s what actually
            happened, but it means you&apos;re risking more than your tracked bankroll covers.
          </div>
        )}
        <FormField label="Polymarket URL (optional)">
          <Input
            value={polymarketUrl}
            onChange={(e) => setPolymarketUrl(e.target.value)}
            placeholder="https://polymarket.com/event/..."
          />
        </FormField>
        <FormField label="Notes (optional)">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          <PlusCircle /> Add trade
        </Button>
      </CardContent>
    </Card>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-neutral-500">{label}</label>
      {children}
    </div>
  );
}
