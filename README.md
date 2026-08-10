# Polymarket Smart Money Consensus

A research and analytics dashboard for aggregating open Polymarket wallet
positions into weighted "smart-money consensus" trade ideas.

**This is a research tool only.** It does not execute trades, connect
wallets, or place orders, and nothing it outputs is investment advice.

> Not financial advice. Wallet activity may be stale, hedged, or wrong. Do your own research.

## What it does

1. You paste a list of Polygon wallet addresses (one per line, or comma-separated).
2. The server fetches each wallet's current open positions from Polymarket's
   public Data API, filters to markets that are still active/unresolved, and
   drops dust positions below a configurable minimum value (default $100).
3. Positions are normalized and grouped by market + specific outcome — Yes
   and No are **never** merged into a single directional bet.
4. Each wallet gets a transparent quality score based on active exposure,
   market diversification, and recency (see [Scoring](#scoring) below).
5. Positions are aggregated into ranked "consensus ideas" with a weighted
   score, risk flags, and a deterministic (template-based, no LLM)
   explanation.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No API keys or
environment variables are required — every Polymarket endpoint used is
public and unauthenticated.

Other commands:

```bash
npm run lint     # ESLint
npx tsc --noEmit # Type check
npm run test     # Vitest unit tests
npm run build    # Production build
```

Click **Load demo** on the dashboard to see the UI populated with a
realistic fixture dataset without hitting any live API — useful if
Polymarket's APIs are unreachable or rate-limited.

## API endpoints used

All requests are made from Next.js server routes (`app/api/analyze/route.ts`)
to avoid browser CORS issues and keep the client wallet-list-only.

| API | Base URL | Used for |
|---|---|---|
| Data API | `https://data-api.polymarket.com` | `GET /positions?user=` — current open positions per wallet. `GET /activity?user=` — recent activity, used to derive per-market last-active timestamps and (via `REDEEM` events) the wallet score's realized-signal component. |
| Gamma API | `https://gamma-api.polymarket.com` | `GET /markets?condition_ids=...&include_tag=true` — market status (active/closed), liquidity, volume, spread, and tags, per condition ID, batched across all positions found. Note: `/markets` has no plain `category` field; `include_tag=true` is required to get `tags[]`, which is what actually drives the dashboard's category derivation and filter. |
| CLOB API | `https://clob.polymarket.com` | Base URL wired for future price/order-book enrichment; not required for the current position-based scoring, which already gets live price via the Data API's `curPrice` field. |

Requests use a timeout + exponential-backoff retry (`lib/polymarket/http.ts`),
and wallets are fetched with a concurrency limit of 15 so one slow or
failing wallet never blocks or crashes the whole batch — failures are
captured per-wallet and shown in the "Wallet load status" tab. Gamma market
enrichment (liquidity, tags, status) is similarly chunked and fetched with
bounded concurrency rather than sequentially, since a large wallet list can
easily touch hundreds of distinct markets. Progress streams to the client as
newline-delimited JSON so the UI can show "Analyzing N of M wallets…".
Analysis results are treated as fresh for 60 seconds client-side before a
manual "Refresh" re-fetches.

No per-run wallet cap — analyze as many unique wallets as you paste. Larger
lists just take proportionally longer (see the concurrency limits above);
there's no truncation or rejection based on wallet count.

## Scoring

### Wallet quality score (0–100)

```
walletScore =
  28% × active position value (log-scaled, caps around $10k)
  + 22% × number of distinct active markets (caps at 10+)
  + 22% × recency of activity (exponential decay, 72-hour half-life)
  + 18% × (100 − concentration penalty), a Herfindahl index so one
          oversized position can't dominate the score
  + 10% × recent redeemed (claimed) positions
```

capped at 40 if the wallet is active in fewer than 2 markets (can't assess
diversification from one data point).

**This is explicitly not a verified historical win rate.** Reconstructing a
wallet's full closed-trade history from public endpoints at reasonable cost
isn't feasible for arbitrary wallets. One piece of real on-chain evidence is
folded in at low weight (10%) though: recent `REDEEM` events from the Data
API's `/activity` endpoint — claiming payout from a resolved market. A
rational wallet doesn't bother redeeming worthless losing shares, so a
recent redemption is a genuine, cheap proxy for a recent win, even though
it's not a comprehensive win rate (it only sees whatever falls inside the
fetched activity window, and says nothing about markets that haven't
resolved yet). Wallets with zero redeem history score neutral (50) on this
component, not zero — the UI and methodology panel say so directly.

### Consensus score (0–100) per market outcome

```
consensusScore =
  35% × weighted wallet alignment (log-scaled $ exposure, wallet-quality-weighted)
  + 20% × number of independent wallets aligned
  + 15% × recency (same exponential decay as wallet scoring)
  + 15% × market liquidity / spread quality
  + 15% × agreement (share of weight on this side vs. the opposing side)
```

Penalties are then subtracted for: fewer than 3 aligned wallets, unknown or
low liquidity, wide spread, stale positions, material disagreement among
tracked wallets, a large price move since the median entry, near-resolution
timing, thin aggregate position size, and **concentrated exposure** (see
below). An idea requires at least 2 independent wallets to be surfaced at
all.

### Concentration risk

Wallet count alone doesn't detect a whale-dominated signal: 8 wallets aligned
where one holds 90% of the dollar exposure is really a one-wallet bet wearing
an 8-wallet headcount. Each idea's aligned wallets get a Herfindahl index
(`concentrationHHI`, 0–1) over their quality-weighted exposure — `0.35+`
applies a moderate penalty and risk flag, `0.5+` a full penalty with an
explicit "exposure concentrated in one wallet" flag. This is exposed on
`TradeIdea.concentrationHHI` and shown in the market detail view alongside
each wallet's share of that side's exposure, so a dominant wallet is visible
at a glance rather than hidden behind a headcount. `medianEntryProbability`
is exposure-weighted for the same reason — an unweighted median lets a
handful of small tag-along positions dilute (or, just as often, be drowned
out by) the price a dominant wallet actually paid.

### Position signal tiers

Every individual position gets a size-based label — purely about dollar
value, not consensus or win probability:

| Tier | Range |
|---|---|
| Standard signal | $100–$499 |
| Strong signal | $500–$1,999 |
| High-conviction signal | $2,000+ |

The default minimum position value is $100 (the Standard-signal floor), so
dust positions don't crowd out ones worth looking at. Configurable in the
Wallets panel.

Confidence label: **High** requires score ≥ 68 and ≥ 3 independent aligned
wallets; **Medium** is score ≥ 40; everything else is **Low**. Wallet count
and liquidity already feed the score directly (20% and 15% weight, plus the
penalties above), so the label reads off that already-penalized score rather
than re-checking the same signal a second time as a separate hard gate.

The dollar caps behind the log-scaled components (wallet active-value score,
consensus weighted-exposure score, consensus liquidity score) are calibrated
against live Gamma/Data API sampling, not round guesses: most real,
non-mega-cap markets carry roughly $1k–$60k liquidity, and quality-weighted
aligned exposure (raw $ × wallet score, itself a 0–1 fraction) rarely reaches
five figures even for genuinely strong consensus. Caps set at $50k–$100k left
nearly everything scoring near the bottom of these components regardless of
signal strength, so almost nothing could ever reach "High" on real data. As
before, the label never reflects a prediction of outcome probability — only
whether the underlying data supports calling the signal strong, deep, and
fresh.

An "equal weighting" toggle is available if you'd rather ignore wallet
quality scores and count every aligned wallet the same.

### Categories and subcategories

Category (Sports, Politics, Crypto, etc.) is derived from Polymarket's own
market tags — see [Position signal tiers](#position-signal-tiers) note above
on `include_tag=true`. Within Sports, a second-level subcategory narrows to a
specific league: NFL, NBA, MLB, NHL, CFB (collapsing the CFB/NCAAF/"college
football" tag variants Polymarket uses interchangeably into one bucket),
College Basketball, Soccer, UFC/MMA, Boxing, Tennis, Golf, Formula 1, NASCAR,
Esports, Olympics, Cricket, and Rugby — all verified against live tag data,
not guessed. A few non-sports categories carry subcategories too (Economy >
Fed, Crypto > Bitcoin/Ethereum/Altcoins, Politics > US/World Elections). See
`SUBCATEGORY_GROUPS` in `lib/polymarket/gamma-api.ts` for the full mapping.
The subcategory filter on the dashboard is scoped to whichever category is
currently selected.

### CSV export

The "Export CSV" button on the consensus table exports exactly what's
currently visible — respecting every active filter (including category and
subcategory) and the current sort order — with `Category` and `Subcategory`
columns included so you can re-group in a spreadsheet afterward.

## Project structure

```
app/page.tsx              Dashboard page (renders <Dashboard />)
app/api/analyze/route.ts  Streaming NDJSON analysis endpoint
lib/types.ts              Zod schemas for raw API responses + normalized domain types
lib/polymarket/           Raw API adapters (data-api, gamma-api), http retry/concurrency helpers, wallet parsing
lib/scoring/               Deterministic scoring: wallet-score, consensus, recency decay, explanation templates
lib/analyze.ts             Orchestrates fetch → normalize → score → aggregate
lib/demo-data.ts           Realistic offline fixture data for "Load demo"
components/                Dashboard UI (wallet input, summary cards, consensus table, drawers, methodology)
tests/                     Vitest unit tests for parsing, normalization, grouping, scoring, recency, conflicts, risk flags
```

## Limitations and disclaimer

- Positions can be hedges, market-making inventory, or one leg of a
  multi-market strategy — holding a position is not the same as directional
  conviction.
- A price that has already moved past a wallet's entry may mean the thesis
  already played out, or that new information has arrived since — the
  dashboard flags large moves but doesn't interpret them for you.
- Liquidity, volume, and spread come from Gamma API metadata and can be
  stale, or momentarily unavailable; when unavailable, ideas are scored
  conservatively and flagged rather than assumed favorable.
- Wallet activity data can lag on-chain state.
- The wallet quality score is based on observable position data, not a
  verified track record.
- This app has no trading, wallet-connection, or order-placement
  functionality by design, and none should be added without re-reading the
  disclaimers above.

**Not financial advice. Wallet activity may be stale, hedged, or wrong. Do
your own research.**
