import type { Request, Response, NextFunction } from "express";
import { cleanStore } from "../store";

const ALLOWED = new Set(["call", "email", "demo"]);

function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

function isOpenStage(stage: string) {
  const s = norm(stage);
  return s !== "Closed Won" && s !== "Closed Lost";
}

export const getOpenDealsLatestActivity = (req: Request, res: Response, next: NextFunction) => {
  try {
    const openDealIds = new Set(cleanStore.deals.filter((d) => isOpenStage(d.stage)).map((d) => d.deal_id));

    // latest activity per open deal
    const latest = new Map<string, { type: string; timestamp: string }>();

    for (const a of cleanStore.activities) {
      if (!openDealIds.has(a.deal_id)) continue;

      const curTs = new Date(a.timestamp).getTime();
      if (Number.isNaN(curTs)) continue;

      const prev = latest.get(a.deal_id);
      const prevTs = prev ? new Date(prev.timestamp).getTime() : -Infinity;

      if (!prev || curTs > prevTs) latest.set(a.deal_id, { type: String(a.type), timestamp: a.timestamp });
    }

    const counts = new Map<string, number>();
    for (const [, act] of latest) {
      const t = String(act.type).toLowerCase().trim();
      if (!ALLOWED.has(t)) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }

    const rows = Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({
      status: "ok",
      latestActivity: { rows },
    });
  } catch (err) {
    return next(err);
  }
};
