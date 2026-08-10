"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatUsd } from "@/lib/utils";

export function StartingBankrollCard({
  startingBankrollUsd,
  startingBankrollSetAt,
  onSet,
}: {
  startingBankrollUsd: number | null;
  startingBankrollSetAt: string | null;
  onSet: (amount: number) => void;
}) {
  const [draft, setDraft] = useState("");
  // Editing is only ever toggled explicitly (Edit/Save) — it must not be
  // seeded from startingBankrollUsd at mount, since that prop starts null
  // pre-hydration (before localStorage loads) even when a bankroll is
  // already saved, which previously made this card flash back to the edit
  // form on every reload.
  const [isEditingOverride, setIsEditingOverride] = useState(false);
  const showForm = startingBankrollUsd === null || isEditingOverride;

  function handleEdit() {
    setDraft(startingBankrollUsd?.toString() ?? "");
    setIsEditingOverride(true);
  }

  function handleSave() {
    const amount = Number(draft);
    if (!Number.isFinite(amount) || amount <= 0) return;
    onSet(amount);
    setIsEditingOverride(false);
  }

  if (!showForm) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-0">
          <CardTitle>Starting bankroll</CardTitle>
          <Button size="sm" variant="ghost" onClick={handleEdit}>
            Edit
          </Button>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="text-2xl font-semibold text-neutral-100">
            {formatUsd(startingBankrollUsd)}
          </div>
          {startingBankrollSetAt && (
            <div className="mt-1 text-xs text-neutral-500">
              Set {new Date(startingBankrollSetAt).toLocaleDateString()}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Starting bankroll</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="starting-bankroll">
            Amount ($)
          </label>
          <Input
            id="starting-bankroll"
            type="number"
            min={0}
            step="0.01"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="1000"
            className="w-36"
          />
        </div>
        <Button onClick={handleSave} disabled={!draft || Number(draft) <= 0}>
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
