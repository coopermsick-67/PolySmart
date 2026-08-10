import { Badge } from "@/components/ui/badge";
import { classifySignalTier } from "@/lib/scoring/signal-tier";

const TIER_VARIANT = {
  Standard: "secondary",
  Strong: "warning",
  "High-conviction": "default",
} as const;

/** Renders a position's dollar-size signal tier (Standard/Strong/High-conviction), or nothing below the $100 floor. */
export function SignalTierBadge({ valueUsd }: { valueUsd: number }) {
  const tier = classifySignalTier(valueUsd);
  if (tier === null) return null;
  return <Badge variant={TIER_VARIANT[tier]}>{tier}</Badge>;
}
