import React, { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";

import { Box, Card, CardContent, Divider, Typography } from "@mui/material";

import PipelineSparkline from "./charts/PipelineSparkline";
import WinRateBars from "./charts/WinRateBars";
import AvgDealSparkline from "./charts/AvgDealSparkline";
import SalesCycleSparkline from "./charts/SalesCycleSparkline";

type Deal = {
  deal_id: string;
  stage: string;
  amount: number | null;
  created_at: string; // YYYY-MM-DD
  closed_at: string | null; // YYYY-MM-DD or null
};

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

/* ---------------- Clean helpers ---------------- */

const STAGE_PRIORITY: Record<string, number> = {
  Prospecting: 1,
  Negotiation: 2,
  "Closed Lost": 3,
  "Closed Won": 4,
};

function normalizeStage(stage: string) {
  return (stage ?? "").trim();
}

function collapseDealsToHighestStage(deals: Deal[]): Deal[] {
  const best = new Map<string, Deal>();

  for (const raw of deals) {
    if (!raw.deal_id) continue;

    const d: Deal = { ...raw, stage: normalizeStage(raw.stage) };
    const existing = best.get(d.deal_id);

    if (!existing) {
      best.set(d.deal_id, d);
      continue;
    }

    const curRank = STAGE_PRIORITY[d.stage] ?? 0;
    const prevRank = STAGE_PRIORITY[normalizeStage(existing.stage)] ?? 0;

    if (curRank > prevRank) best.set(d.deal_id, d);
    else if (curRank === prevRank) {
      if (d.closed_at && !existing.closed_at) best.set(d.deal_id, d);
    }
  }

  return Array.from(best.values());
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function safeAmount(a: number | null) {
  return typeof a === "number" && a > 0 ? a : 0;
}

function daysBetween(a: string, b: string): number | null {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  if (Number.isNaN(d1) || Number.isNaN(d2)) return null;
  if (d2 < d1) return null;
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/* ---------------- Formatting helpers ---------------- */

function formatMoneyCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatPct(p: number) {
  return `${Math.round(p * 100)}%`;
}

function formatDeltaPct(delta: number) {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${Math.round(delta * 100)}%`;
}

function formatDeltaMoneyPct(curr: number, prev: number) {
  if (prev === 0) return curr === 0 ? "0%" : "+100%";
  const delta = (curr - prev) / prev;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${Math.round(delta * 100)}%`;
}

function deltaColor(delta: number) {
  return delta >= 0 ? "#16a34a" : "#dc2626";
}

/* ---------------- UI Row ---------------- */

function Row({
  title,
  value,
  delta,
  deltaColor,
  children,
}: {
  title: string;
  value: string;
  delta: string;
  deltaColor: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ py: 1.25 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          mb: 0.5,
          gap: 1,
        }}
      >
        <Typography sx={{ fontWeight: 600 }}>{title}</Typography>

        <Box sx={{ display: "flex", gap: 2, alignItems: "baseline" }}>
          <Typography sx={{ fontWeight: 700 }}>{value}</Typography>
          <Typography sx={{ fontWeight: 700, color: deltaColor }}>
            {delta}
          </Typography>
        </Box>
      </Box>

      {/* chart area */}
      <Box
        sx={{
          width: "100%",
          height: 210,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box sx={{ width: "100%" }}>{children}</Box>
      </Box>
    </Box>
  );
}

/* ---------------- Component ---------------- */

export default function RevenueDriversCard() {
  const [deals, setDeals] = useState<Deal[] | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await loadJson<Deal[]>("/data/deals.json");
      const cleaned = collapseDealsToHighestStage(raw);
      setDeals(cleaned);
    })().catch(console.error);
  }, []);

  const metrics = useMemo(() => {
    if (!deals || deals.length === 0) return null;

    // months present in data (use created_at for open pipeline, closed_at for closed outcomes)
    const monthsSet = new Set<string>();
    for (const d of deals) {
      monthsSet.add(monthKey(d.created_at));
      if (d.closed_at) monthsSet.add(monthKey(d.closed_at));
    }
    const months = Array.from(monthsSet).sort(); // YYYY-MM sorted
    const curMonth = months[months.length - 1];
    const prevMonth = months[months.length - 2];

    // -------- Pipeline Value (open deals created in month) --------
    const pipelineForMonth = (m: string) => {
      const open = deals.filter(
        (d) =>
          monthKey(d.created_at) === m &&
          d.stage !== "Closed Won" &&
          d.stage !== "Closed Lost"
      );
      return open.reduce((s, d) => s + safeAmount(d.amount), 0);
    };

    const pipelineCur = pipelineForMonth(curMonth);
    const pipelinePrev = prevMonth ? pipelineForMonth(prevMonth) : 0;
    const pipelineDelta = pipelinePrev === 0 ? (pipelineCur === 0 ? 0 : 1) : (pipelineCur - pipelinePrev) / pipelinePrev;

    // -------- Win Rate (Closed Won / (Won+Lost) for close month) --------
    const winRateForMonth = (m: string) => {
      const closed = deals.filter(
        (d) =>
          d.closed_at &&
          monthKey(d.closed_at) === m &&
          (d.stage === "Closed Won" || d.stage === "Closed Lost")
      );
      const won = closed.filter((d) => d.stage === "Closed Won").length;
      const lost = closed.filter((d) => d.stage === "Closed Lost").length;
      const denom = won + lost;
      return denom === 0 ? 0 : won / denom;
    };

    const winCur = winRateForMonth(curMonth);
    const winPrev = prevMonth ? winRateForMonth(prevMonth) : 0;
    const winDelta = winCur - winPrev; // absolute percentage points

    // -------- Avg Deal Size (avg amount of deals created in month) --------
    const avgDealForMonth = (m: string) => {
      const v = deals
        .filter((d) => monthKey(d.created_at) === m)
        .map((d) => d.amount)
        .filter((a): a is number => typeof a === "number" && a > 0);
      return v.length === 0 ? 0 : (d3.mean(v) ?? 0);
    };

    const avgCur = avgDealForMonth(curMonth);
    const avgPrev = prevMonth ? avgDealForMonth(prevMonth) : 0;
    const avgDelta = avgPrev === 0 ? (avgCur === 0 ? 0 : 1) : (avgCur - avgPrev) / avgPrev;

    // -------- Sales Cycle (avg days to close for closed deals in close month) --------
    const salesCycleForMonth = (m: string) => {
      const closed = deals.filter(
        (d) =>
          d.closed_at &&
          monthKey(d.closed_at) === m &&
          (d.stage === "Closed Won" || d.stage === "Closed Lost")
      );
      const cycles = closed
        .map((d) => daysBetween(d.created_at, d.closed_at!))
        .filter((x): x is number => typeof x === "number");
      return cycles.length === 0 ? 0 : (d3.mean(cycles) ?? 0);
    };

    const cycleCur = salesCycleForMonth(curMonth);
    const cyclePrev = prevMonth ? salesCycleForMonth(prevMonth) : 0;
    const cycleDeltaDays = cycleCur - cyclePrev;

    return {
      pipeline: {
        value: formatMoneyCompact(pipelineCur),
        deltaText: formatDeltaMoneyPct(pipelineCur, pipelinePrev),
        delta: pipelineDelta,
      },
      winRate: {
        value: formatPct(winCur),
        // show as percentage points like -4% in your screenshot style
        deltaText: `${winDelta >= 0 ? "+" : ""}${Math.round(winDelta * 100)}%`,
        delta: winDelta,
      },
      avgDeal: {
        value: formatMoneyCompact(avgCur),
        deltaText: formatDeltaMoneyPct(avgCur, avgPrev),
        delta: avgDelta,
      },
      salesCycle: {
        value: `${Math.round(cycleCur)} Days`,
        deltaText: `${cycleDeltaDays >= 0 ? "+" : ""}${Math.round(cycleDeltaDays)} Days`,
        // for color: increase in cycle is "bad" usually, so invert logic
        delta: -cycleDeltaDays, // negative means "worse", so color becomes red when cycle increases
        rawDeltaDays: cycleDeltaDays,
      },
    };
  }, [deals]);

  return (
    <Card sx={{ width: 380 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Revenue Drivers
        </Typography>
        <Divider />

        <Row
          title="Pipeline Value"
          value={metrics ? metrics.pipeline.value : "—"}
          delta={metrics ? metrics.pipeline.deltaText : "—"}
          deltaColor={metrics ? deltaColor(metrics.pipeline.delta) : "#6b7280"}
        >
          <PipelineSparkline />
        </Row>

        <Divider />

        <Row
          title="Win Rate"
          value={metrics ? metrics.winRate.value : "—"}
          delta={metrics ? metrics.winRate.deltaText : "—"}
          deltaColor={metrics ? deltaColor(metrics.winRate.delta) : "#6b7280"}
        >
          <WinRateBars />
        </Row>

        <Divider />

        <Row
          title="Avg Deal Size"
          value={metrics ? metrics.avgDeal.value : "—"}
          delta={metrics ? metrics.avgDeal.deltaText : "—"}
          deltaColor={metrics ? deltaColor(metrics.avgDeal.delta) : "#6b7280"}
        >
          <AvgDealSparkline />
        </Row>

        <Divider />

        <Row
          title="Sales Cycle"
          value={metrics ? metrics.salesCycle.value : "—"}
          delta={metrics ? metrics.salesCycle.deltaText : "—"}
          // increase in cycle should be red, decrease green
          deltaColor={
            metrics
              ? metrics.salesCycle.rawDeltaDays <= 0
                ? "#16a34a"
                : "#dc2626"
              : "#6b7280"
          }
        >
          <SalesCycleSparkline />
        </Row>
      </CardContent>
    </Card>
  );
}
