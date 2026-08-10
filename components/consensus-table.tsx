"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { formatCents, formatRelativeTime, formatUsd } from "@/lib/utils";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import type { ConfidenceLabel, TradeIdea } from "@/lib/types";

type SortKey =
  | "consensusScore"
  | "currentProbability"
  | "walletsAligned"
  | "walletsOpposed"
  | "weightedExposure"
  | "liquidity"
  | "lastActivityTs";

interface Filters {
  minScore: number;
  minWallets: number;
  minExposure: number;
  category: string;
  subCategory: string;
  confidence: ConfidenceLabel | "All";
  hideStale: boolean;
  hideLowLiquidity: boolean;
}

const DEFAULT_FILTERS: Filters = {
  minScore: 0,
  minWallets: 0,
  minExposure: 0,
  category: "All",
  subCategory: "All",
  confidence: "All",
  hideStale: false,
  hideLowLiquidity: false,
};

const CSV_COLUMNS = [
  { header: "Rank", value: (idea: TradeIdea, index: number) => index + 1 },
  { header: "Market", value: (idea: TradeIdea) => idea.marketQuestion },
  { header: "Outcome", value: (idea: TradeIdea) => idea.outcome },
  { header: "Category", value: (idea: TradeIdea) => idea.category },
  { header: "Subcategory", value: (idea: TradeIdea) => idea.subCategory },
  { header: "Current Probability", value: (idea: TradeIdea) => idea.currentProbability },
  { header: "Median Entry Probability", value: (idea: TradeIdea) => idea.medianEntryProbability },
  { header: "Consensus Score", value: (idea: TradeIdea) => idea.consensusScore },
  { header: "Confidence", value: (idea: TradeIdea) => idea.confidence },
  { header: "Wallets Aligned", value: (idea: TradeIdea) => idea.walletsAligned },
  { header: "Wallets Opposed", value: (idea: TradeIdea) => idea.walletsOpposed },
  { header: "Weighted Exposure", value: (idea: TradeIdea) => idea.weightedExposure },
  { header: "Unweighted Exposure", value: (idea: TradeIdea) => idea.unweightedExposure },
  { header: "Concentration (HHI)", value: (idea: TradeIdea) => idea.concentrationHHI },
  { header: "Liquidity", value: (idea: TradeIdea) => idea.liquidity },
  { header: "Volume", value: (idea: TradeIdea) => idea.volume },
  { header: "Last Active (Unix)", value: (idea: TradeIdea) => idea.lastActivityTs },
  { header: "Risk Flags", value: (idea: TradeIdea) => idea.riskFlags.join("; ") },
  { header: "Polymarket URL", value: (idea: TradeIdea) => idea.polymarketUrl },
];

const STALE_THRESHOLD_HOURS = 48;
const LOW_LIQUIDITY_THRESHOLD = 500;

function confidenceVariant(c: ConfidenceLabel): "default" | "warning" | "danger" {
  if (c === "High") return "default";
  if (c === "Medium") return "warning";
  return "danger";
}

export function ConsensusTable({
  ideas,
  onSelectIdea,
  nowSeconds,
}: {
  ideas: TradeIdea[];
  onSelectIdea: (idea: TradeIdea) => void;
  /** Reference "now" for staleness filtering — pass the analysis fetch time, not a live clock. */
  nowSeconds: number;
}) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("consensusScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const i of ideas) if (i.category) set.add(i.category);
    return [{ value: "All", label: "All" }, ...Array.from(set).sort().map((c) => ({ value: c, label: c }))];
  }, [ideas]);

  // Subcategory options are scoped to the selected category (e.g. picking
  // "Sports" narrows this to NFL/NBA/MLB/etc. instead of every subcategory
  // across every category at once).
  const subCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const i of ideas) {
      if (!i.subCategory) continue;
      if (filters.category !== "All" && i.category !== filters.category) continue;
      set.add(i.subCategory);
    }
    return [{ value: "All", label: "All" }, ...Array.from(set).sort().map((c) => ({ value: c, label: c }))];
  }, [ideas, filters.category]);

  const filtered = useMemo(() => {
    return ideas.filter((idea) => {
      if (idea.consensusScore < filters.minScore) return false;
      if (idea.walletsAligned < filters.minWallets) return false;
      if (idea.weightedExposure < filters.minExposure) return false;
      if (filters.category !== "All" && idea.category !== filters.category) return false;
      if (filters.subCategory !== "All" && idea.subCategory !== filters.subCategory) return false;
      if (filters.confidence !== "All" && idea.confidence !== filters.confidence) return false;
      if (filters.hideStale) {
        const ageHours = idea.lastActivityTs ? (nowSeconds - idea.lastActivityTs) / 3600 : Infinity;
        if (ageHours > STALE_THRESHOLD_HOURS) return false;
      }
      if (filters.hideLowLiquidity) {
        if (idea.liquidity === null || idea.liquidity < LOW_LIQUIDITY_THRESHOLD) return false;
      }
      return true;
    });
  }, [ideas, filters, nowSeconds]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      const cmp = av === bv ? 0 : av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  function handleExportCsv() {
    const csv = buildCsv(sorted, CSV_COLUMNS);
    const categoryPart = filters.category !== "All" ? `-${filters.category}` : "";
    const subCategoryPart = filters.subCategory !== "All" ? `-${filters.subCategory}` : "";
    const datePart = new Date().toISOString().slice(0, 10);
    downloadCsv(`polymarket-consensus-ideas${categoryPart}${subCategoryPart}-${datePart}.csv`, csv);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
        <FilterNumber label="Min score" value={filters.minScore} onChange={(v) => setFilters((f) => ({ ...f, minScore: v }))} />
        <FilterNumber label="Min wallets" value={filters.minWallets} onChange={(v) => setFilters((f) => ({ ...f, minWallets: v }))} />
        <FilterNumber label="Min exposure ($)" value={filters.minExposure} onChange={(v) => setFilters((f) => ({ ...f, minExposure: v }))} />

        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Category</span>
          <Combobox
            value={filters.category}
            onValueChange={(v) => setFilters((f) => ({ ...f, category: v, subCategory: "All" }))}
            options={categoryOptions}
            placeholder="Search categories…"
            triggerClassName="w-32"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Subcategory</span>
          <Combobox
            value={filters.subCategory}
            onValueChange={(v) => setFilters((f) => ({ ...f, subCategory: v }))}
            options={subCategoryOptions}
            placeholder="Search subcategories…"
            triggerClassName="w-36"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Confidence</span>
          <Select
            value={filters.confidence}
            onValueChange={(v) => setFilters((f) => ({ ...f, confidence: v as Filters["confidence"] }))}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <Checkbox
            checked={filters.hideStale}
            onCheckedChange={(v) => setFilters((f) => ({ ...f, hideStale: v === true }))}
          />
          Hide stale (&gt;48h)
        </label>
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <Checkbox
            checked={filters.hideLowLiquidity}
            onCheckedChange={(v) => setFilters((f) => ({ ...f, hideLowLiquidity: v === true }))}
          />
          Hide low liquidity
        </label>

        {JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset filters
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-neutral-500">
            {sorted.length} of {ideas.length} ideas
          </span>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={sorted.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Market</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead><SortHeader label="Prob." sortableKey="currentProbability" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead><SortHeader label="Score" sortableKey="consensusScore" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead><SortHeader label="Aligned" sortableKey="walletsAligned" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead><SortHeader label="Opposed" sortableKey="walletsOpposed" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead><SortHeader label="Exposure" sortableKey="weightedExposure" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead><SortHeader label="Liquidity" sortableKey="liquidity" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead><SortHeader label="Last active" sortableKey="lastActivityTs" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead>Risk</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="py-8 text-center text-neutral-500">
                  No consensus ideas match these filters.
                </TableCell>
              </TableRow>
            )}
            {sorted.map((idea, i) => (
              <TableRow key={idea.id}>
                <TableCell className="text-neutral-500">{i + 1}</TableCell>
                <TableCell className="max-w-64 truncate font-medium text-neutral-100" title={idea.marketQuestion}>
                  {idea.marketQuestion}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{idea.outcome}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">{formatCents(idea.currentProbability)}</TableCell>
                <TableCell className="tabular-nums font-semibold text-emerald-400">
                  {idea.consensusScore.toFixed(1)}
                </TableCell>
                <TableCell className="tabular-nums">{idea.walletsAligned}</TableCell>
                <TableCell className="tabular-nums text-neutral-400">{idea.walletsOpposed}</TableCell>
                <TableCell className="tabular-nums">{formatUsd(idea.weightedExposure, { compact: true })}</TableCell>
                <TableCell className="tabular-nums">{formatUsd(idea.liquidity, { compact: true })}</TableCell>
                <TableCell className="text-neutral-400">{formatRelativeTime(idea.lastActivityTs)}</TableCell>
                <TableCell>
                  {idea.riskFlags.length > 0 ? (
                    <Badge variant="danger">{idea.riskFlags.length} flag{idea.riskFlags.length > 1 ? "s" : ""}</Badge>
                  ) : (
                    <Badge variant={confidenceVariant(idea.confidence)}>{idea.confidence}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="secondary" onClick={() => onSelectIdea(idea)}>
                    View details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function getSortValue(idea: TradeIdea, key: SortKey): number {
  switch (key) {
    case "consensusScore":
      return idea.consensusScore;
    case "currentProbability":
      return idea.currentProbability;
    case "walletsAligned":
      return idea.walletsAligned;
    case "walletsOpposed":
      return idea.walletsOpposed;
    case "weightedExposure":
      return idea.weightedExposure;
    case "liquidity":
      return idea.liquidity ?? -1;
    case "lastActivityTs":
      return idea.lastActivityTs ?? -1;
    default:
      return 0;
  }
}

function SortHeader({
  label,
  sortableKey,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  sortableKey: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onToggle: (key: SortKey) => void;
}) {
  const active = sortKey === sortableKey;
  return (
    <button className="flex items-center gap-1 hover:text-neutral-200" onClick={() => onToggle(sortableKey)}>
      {label}
      {active ? (
        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function FilterNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-neutral-500">{label}</span>
      <Input
        type="number"
        className="w-28"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
