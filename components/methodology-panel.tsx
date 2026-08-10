import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MethodologyPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-neutral-200">Methodology</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm text-neutral-400">
        <section>
          <h4 className="mb-1 font-medium text-neutral-200">Consensus score formula</h4>
          <pre className="overflow-x-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-300">
{`consensusScore =
  35% × weighted wallet alignment (log-scaled $ exposure)
  + 20% × number of independent wallets aligned
  + 15% × recency (exponential decay, 72h half-life)
  + 15% × market liquidity / spread quality
  + 15% × agreement (share of weight vs. opposing side)

minus penalties for: <3 aligned wallets, unknown/low liquidity,
wide spread, stale positions, material disagreement, large price
moves since entry, near-resolution timing, thin aggregate size,
and exposure concentrated in one or two wallets (see below).

Confidence label:
  High   — score ≥ 68 and ≥3 independent wallets aligned
  Medium — score ≥ 40
  Low    — below 40

Wallet count and liquidity feed the score directly (20% and 15%
weight, plus explicit penalties below) — the confidence label reads
off that already-penalized score rather than re-checking the same
signal a second time.`}
          </pre>
        </section>

        <section>
          <h4 className="mb-1 font-medium text-neutral-200">Wallet quality score</h4>
          <pre className="overflow-x-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-300">
{`walletScore =
  28% × active position value (log-scaled, $10k+ caps it)
  + 22% × number of distinct active markets (10+ caps it)
  + 22% × recency of activity (same exponential decay)
  + 18% × (100 − concentration penalty), so one whale
          position can't dominate the score
  + 10% × recent redeemed (claimed) positions

capped at 40 if the wallet holds fewer than 2 active markets.`}
          </pre>
          <p className="mt-2">
            This is <strong className="text-neutral-200">not</strong> a verified historical win
            rate — public position data doesn&apos;t give cheap access to a wallet&apos;s full
            closed-trade history. One piece of real on-chain evidence is folded in at low weight
            (10%): recent <em>REDEEM</em> activity, i.e. claiming payout from a resolved market. A
            rational wallet doesn&apos;t bother redeeming worthless losing shares, so this is a
            genuine proxy for recent wins — not a comprehensive win rate. Wallets with no redeem
            history score neutral (50) on this component, not zero, since it usually just means
            nothing they hold has resolved yet.
          </p>
        </section>

        <section>
          <h4 className="mb-1 font-medium text-neutral-200">Concentration risk</h4>
          <p>
            Wallet <em>count</em> alone can be misleading: an idea with 8 aligned wallets where one
            holds 90% of the dollar exposure is really a one-wallet signal wearing an 8-wallet
            headcount. Each idea&apos;s aligned wallets get a Herfindahl index (0–1, higher = more
            concentrated) over their quality-weighted exposure — at 0.35+ it&apos;s flagged as
            &quot;moderately concentrated&quot;, at 0.5+ as a full penalty with an explicit risk
            flag. The market detail view shows this as &quot;Concentration&quot; and breaks out
            each wallet&apos;s % of that side&apos;s exposure so you can see who&apos;s actually
            driving the number. The median entry price shown is also exposure-weighted, not a flat
            average across wallets, so one dominant wallet&apos;s entry isn&apos;t diluted by several small
            tag-along positions (or vice versa).
          </p>
        </section>

        <section>
          <h4 className="mb-1 font-medium text-neutral-200">Position signal tiers</h4>
          <p>
            Each individual position (shown in the aligned/opposed wallet tables) gets a size-based
            label — this is purely about dollar size, not consensus or win probability:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li><strong className="text-neutral-300">Standard signal</strong>: $100–$499</li>
            <li><strong className="text-neutral-300">Strong signal</strong>: $500–$1,999</li>
            <li><strong className="text-neutral-300">High-conviction signal</strong>: $2,000+</li>
          </ul>
          <p className="mt-1">
            The default minimum position value is $100 — below the Standard-signal floor — so dust
            positions don&apos;t crowd out the ones worth looking at. You can lower or raise this in
            the Wallets panel.
          </p>
        </section>

        <section>
          <h4 className="mb-1 font-medium text-neutral-200">Categories &amp; subcategories</h4>
          <p>
            Category (Sports, Politics, Crypto, etc.) comes from Polymarket&apos;s own market tags,
            picking the broadest recognizable label when a market carries several at once (e.g. a
            League of Legends match is tagged Esports, Games, and Sports all at once — this shows
            &quot;Sports&quot;). A market can show no category if Polymarket hasn&apos;t tagged it.
          </p>
          <p className="mt-1">
            Within Sports, a second Subcategory filter narrows to a specific league — NFL, NBA,
            MLB, NHL, CFB, College Basketball, Soccer, UFC/MMA, Boxing, Tennis, Golf, Formula 1,
            NASCAR, Esports, Olympics, Cricket, and Rugby, matched against Polymarket&apos;s own
            league tags. A few non-sports categories get subcategories too (e.g. Economy &gt; Fed).
            Same rule as category: never fabricated — if a market&apos;s tags don&apos;t match a
            known league, it just shows no subcategory rather than guessing.
          </p>
        </section>

        <section>
          <h4 className="mb-1 font-medium text-neutral-200">CSV export</h4>
          <p>
            The &quot;Export CSV&quot; button on the consensus table exports exactly what&apos;s
            currently visible — respecting the category/subcategory/score/confidence filters and
            current sort order — so you can filter to, say, Sports &gt; NFL and export just that
            slice. The file includes category and subcategory columns so you can also re-group in a
            spreadsheet after the fact.
          </p>
        </section>

        <section>
          <h4 className="mb-1 font-medium text-neutral-200">Important caveats</h4>
          <ul className="list-disc space-y-1 pl-4">
            <li>Positions can be hedges, market-making inventory, or one leg of a multi-market strategy — they don&apos;t always represent directional conviction.</li>
            <li>A price that has already moved past a wallet&apos;s entry may mean the thesis has played out, or that new information has arrived since — either way, it changes the risk/reward of following it now.</li>
            <li>Liquidity, volume, and spread come from Gamma API metadata and can be stale or momentarily unavailable; when unavailable, ideas are scored conservatively and flagged rather than assumed favorable.</li>
            <li>Wallet activity data can lag on-chain state and may not reflect positions closed moments ago.</li>
            <li>Redeem-based signal only sees activity within the fetched activity window — it undercounts wallets with a longer settled history than that window covers.</li>
          </ul>
        </section>

        <p className="rounded-md border border-amber-900/50 bg-amber-950/30 p-3 text-amber-300">
          Not financial advice. Wallet activity may be stale, hedged, or wrong. Do your own research.
        </p>
      </CardContent>
    </Card>
  );
}
