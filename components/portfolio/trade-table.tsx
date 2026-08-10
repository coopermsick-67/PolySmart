import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TradeRow } from "./trade-row";
import type { Trade } from "@/lib/portfolio/types";

export function TradeTable({
  trades,
  onUpdate,
  onDelete,
}: {
  trades: Trade[];
  onUpdate: (id: string, patch: Partial<Trade>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-800">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Market</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Entry</TableHead>
            <TableHead>Stake</TableHead>
            <TableHead>Shares</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>P&amp;L</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-neutral-500">
                No trades logged yet.
              </TableCell>
            </TableRow>
          )}
          {trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
