import type { Request, Response, NextFunction } from "express";
import { cleanStore } from "../store";

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

function isOpenStage(stage: string) {
  const s = norm(stage);
  return s !== "Closed Won" && s !== "Closed Lost";
}

export const getStaleOpenDeals = (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = clampInt(req.query.days, 30, 1, 365);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const counts = new Map<string, number>();
    for (const d of cleanStore.deals) {
      const stage = norm(d.stage);
      if (!isOpenStage(stage)) continue;
      if (!(stage === "Prospecting" || stage === "Negotiation")) continue;

      const created = new Date(d.created_at).getTime();
      if (Number.isNaN(created)) continue;

      if (created < cutoff) {
        counts.set(stage, (counts.get(stage) ?? 0) + 1);
      }
    }

    const rows = ["Prospecting", "Negotiation"].map((stage) => ({
      stage,
      count: counts.get(stage) ?? 0,
    }));

    return res.json({
      status: "ok",
      staleOpenDeals: { days, rows },
    });
  } catch (err) {
    return next(err);
  }
};
