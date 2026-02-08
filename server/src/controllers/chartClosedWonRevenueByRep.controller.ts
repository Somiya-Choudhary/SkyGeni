import type { Request, Response, NextFunction } from "express";
import { cleanStore } from "../store";

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export const getClosedWonRevenueByRep = (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = clampInt(req.query.limit, 12, 3, 50);

    const repNameById = new Map(cleanStore.reps.map((r) => [r.rep_id, r.name ?? "Unknown"]));

    const sums = new Map<string, number>(); // repName -> amount

    for (const d of cleanStore.deals) {
      if (d.stage !== "Closed Won") continue;
      const amt = typeof d.amount === "number" && d.amount > 0 ? d.amount : 0;
      const rep = repNameById.get(d.rep_id) ?? "Unknown";
      sums.set(rep, (sums.get(rep) ?? 0) + amt);
    }

    const rows = Array.from(sums.entries())
      .map(([rep, amount]) => ({ rep, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);

    return res.json({
      status: "ok",
      repRevenue: { rows, limit },
    });
  } catch (err) {
    return next(err);
  }
};
