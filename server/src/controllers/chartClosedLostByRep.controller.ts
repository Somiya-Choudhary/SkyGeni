import type { Request, Response, NextFunction } from "express";
import { cleanStore } from "../store";

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export const getClosedLostByRep = (req: Request, res: Response, next: NextFunction) => {
  try {
    const topN = clampInt(req.query.top, 8, 3, 20);

    const repNameById = new Map(cleanStore.reps.map((r) => [r.rep_id, r.name ?? "Unknown"]));

    const counts = new Map<string, number>(); // repName -> count

    for (const d of cleanStore.deals) {
      if (d.stage !== "Closed Lost") continue;
      const repName = repNameById.get(d.rep_id) ?? "Unknown";
      counts.set(repName, (counts.get(repName) ?? 0) + 1);
    }

    const rows = Array.from(counts.entries())
      .map(([rep, value]) => ({ rep, value }))
      .sort((a, b) => b.value - a.value);

    const top = rows.slice(0, topN);
    const othersValue = rows.slice(topN).reduce((s, r) => s + r.value, 0);
    const final = othersValue > 0 ? [...top, { rep: "Others", value: othersValue }] : top;

    return res.json({
      status: "ok",
      pie: {
        items: final,
        meta: {
          topN,
          totalClosedLost: rows.reduce((s, r) => s + r.value, 0),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};
