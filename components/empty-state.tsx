import { LineChart } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-800 py-20 text-center">
      <LineChart className="h-8 w-8 text-neutral-600" />
      <div className="text-neutral-300">Paste wallet addresses and analyze, or load the demo dataset.</div>
      <div className="max-w-md text-sm text-neutral-500">
        Research candidates will appear here once positions are aggregated across the wallets you
        track.
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-center text-red-300">
      {message}
    </div>
  );
}
