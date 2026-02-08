import type { Request, Response, NextFunction } from "express";
import { cleanStore } from "../store";

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function safeDaysBetween(a: string, b: string): number | null {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (Number.isNaN(t1) || Number.isNaN(t2)) return null;
  if (t2 < t1) return null;
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

const CLOSED = new Set(["Closed Won", "Closed Lost"]);

export const getSalesCycleByRep = (req: Request, res: Response, next: NextFunction) => {
  try {
    const minDeals = clampInt(req.query.minDeals, 3, 1, 50);
    const limit = clampInt(req.query.limit, 12, 3, 50);

    const repNameById = new Map(cleanStore.reps.map((r) => [r.rep_id, r.name ?? "Unknown"]));

    // repName -> {sumDays, count}
    const agg = new Map<string, { sum: number; count: number }>();

    for (const d of cleanStore.deals) {
      if (!CLOSED.has((d.stage ?? "").trim())) continue;
      if (!d.closed_at) continue;
      if (!d.created_at) continue;

      const days = safeDaysBetween(d.created_at, d.closed_at);
      if (typeof days !== "number") continue;

      const rep = repNameById.get(d.rep_id) ?? "Unknown";
      const cur = agg.get(rep) ?? { sum: 0, count: 0 };
      cur.sum += days;
      cur.count += 1;
      agg.set(rep, cur);
    }

    const rows = Array.from(agg.entries())
      .map(([rep, s]) => ({ rep, avgDays: s.count ? s.sum / s.count : 0, deals: s.count }))
      .filter((r) => r.deals >= minDeals)
      .sort((a, b) => a.avgDays - b.avgDays)
      .slice(0, limit);

    return res.json({
      status: "ok",
      salesCycleByRep: { rows, minDeals, limit },
    });
  } catch (err) {
    return next(err);
  }
};
