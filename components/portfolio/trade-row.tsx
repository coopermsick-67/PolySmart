"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { computeTradePnl } from "@/lib/portfolio/calculations";
import { formatCents, formatUsd, safeExternalUrl } from "@/lib/utils";
import { ExternalLink, Trash2 } from "lucide-react";
import type { Trade, TradeStatus } from "@/lib/portfolio/types";

const STATUS_VARIANT: Record<TradeStatus, "default" | "danger" | "warning" | "secondary"> = {
  open: "warning",
  won: "default",
  lost: "danger",
  sold: "secondary",
};

export function TradeRow({
  trade,
  onUpdate,
  onDelete,
}: {
  trade: Trade;
  onUpdate: (id: string, patch: Partial<Trade>) => void;
  onDelete: (id: string) => void;
}) {
  const [mode, setMode] = useState<"none" | "sell" | "price">("none");
  const [inputValue, setInputValue] = useState("");

  const pnl = computeTradePnl(trade);
  const displayPnl = trade.status === "open" ? pnl.unrealizedPnl : pnl.realizedPnl;
  const safeUrl = safeExternalUrl(trade.polymarketUrl);

  function closeAs(status: "won" | "lost") {
    onUpdate(trade.id, { status, closedAt: new Date().toISOString() });
  }

  function confirmSell() {
    const cents = Number(inputValue);
    if (!Number.isFinite(cents) || cents < 0 || cents > 100) return;
    onUpdate(trade.id, { status: "sold", exitPriceCents: cents, closedAt: new Date().toISOString() });
    setMode("none");
    setInputValue("");
  }

  function confirmPrice() {
    const cents = Number(inputValue);
    if (!Number.isFinite(cents) || cents < 0 || cents > 100) return;
    onUpdate(trade.id, { currentPriceCents: cents });
    setMode("none");
    setInputValue("");
  }

  return (
    <TableRow>
      <TableCell className="max-w-56 truncate font-medium text-neutral-100" title={trade.marketQuestion}>
        {safeUrl ? (
          <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-emerald-400">
            {trade.marketQuestion} <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          trade.marketQuestion
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{trade.outcome}</Badge>
      </TableCell>
      <TableCell className="tabular-nums">{formatCents(trade.entryPriceCents / 100)}</TableCell>
      <TableCell className="tabular-nums">{formatUsd(trade.stakeUsd)}</TableCell>
      <TableCell className="tabular-nums text-neutral-400">{pnl.shares.toFixed(1)}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[trade.status]}>{trade.status}</Badge>
      </TableCell>
      <TableCell className={`tabular-nums ${displayPnl !== null && displayPnl >= 0 ? "text-emerald-400" : displayPnl !== null ? "text-red-400" : "text-neutral-500"}`}>
        {displayPnl === null ? "—" : formatUsd(displayPnl)}
      </TableCell>
      <TableCell>
        {trade.status === "open" ? (
          mode === "none" ? (
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="secondary" onClick={() => closeAs("won")}>
                Won
              </Button>
              <Button size="sm" variant="secondary" onClick={() => closeAs("lost")}>
                Lost
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode("sell")}>
                Sell
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode("price")}>
                Update price
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(trade.id)} aria-label="Delete trade">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={mode === "sell" ? "Exit ¢" : "Current ¢"}
                className="h-8 w-24"
              />
              <Button size="sm" onClick={mode === "sell" ? confirmSell : confirmPrice}>
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode("none")}>
                Cancel
              </Button>
            </div>
          )
        ) : (
          <Button size="sm" variant="ghost" onClick={() => onDelete(trade.id)} aria-label="Delete trade">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
