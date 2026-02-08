import type { Request, Response, NextFunction } from "express";
import { cleanStore } from "../store";

const STAGE_PRIORITY: Record<string, number> = {
  Prospecting: 1,
  Negotiation: 2,
  "Closed Lost": 3,
  "Closed Won": 4,
};

const STAGE_ORDER: Array<keyof typeof STAGE_PRIORITY> = [
  "Closed Won",
  "Closed Lost",
  "Negotiation",
  "Prospecting",
];

function normalizeStage(stage: string | null | undefined): string {
  const s = (stage ?? "").trim();
  return s.length ? s : "Unknown";
}

export const getDealsByStage = (req: Request, res: Response, next: NextFunction) => {
  try {
    // cleanStore.deals is already "one per deal_id" (deduped) in your design.
    // But to be 100% safe, we still apply a "highest stage wins" collapse here.

    const bestByDealId = new Map<string, { dealId: string; stage: string }>();

    for (const raw of cleanStore.deals) {
      const dealId = raw.deal_id;
      if (!dealId) continue;

      const stage = normalizeStage(raw.stage);
      const existing = bestByDealId.get(dealId);

      if (!existing) {
        bestByDealId.set(dealId, { dealId, stage });
        continue;
      }

      const curRank = STAGE_PRIORITY[stage] ?? 0;
      const prevRank = STAGE_PRIORITY[normalizeStage(existing.stage)] ?? 0;

      if (curRank > prevRank) bestByDealId.set(dealId, { dealId, stage });
    }

    const collapsed = Array.from(bestByDealId.values());

    const counts = new Map<string, number>();
    for (const d of collapsed) {
      const s = normalizeStage(d.stage);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }

    const chartData = STAGE_ORDER.map((stage) => ({
      stage,
      count: counts.get(stage) ?? 0,
    }));

    const total = chartData.reduce((sum, d) => sum + d.count, 0);

    return res.json({
      status: "ok",
      stageCounts: {
        chartData,
        totalUniqueDeals: collapsed.length,
        total,
      },
    });
  } catch (err) {
    return next(err);
  }
};
