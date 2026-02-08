import type { Request, Response, NextFunction } from "express";
import { cleanStore } from "../store";

const STAGE_ORDER = ["Prospecting", "Negotiation", "Closed Lost", "Closed Won"];

function normalizeStage(stage: string | null | undefined): string {
  const s = (stage ?? "").trim();
  return s.length ? s : "Unknown";
}

export const getStageByRepHeatmap = (req: Request, res: Response, next: NextFunction) => {
  try {
    const repNameById = new Map(cleanStore.reps.map((r) => [r.rep_id, r.name ?? "Unknown"]));

    // Reps list (stable from reps.json)
    const reps = cleanStore.reps.map((r) => r.name ?? "Unknown").sort();
    const stages = STAGE_ORDER;

    const countMap = new Map<string, number>(); // `${rep}__${stage}` -> count

    for (const d of cleanStore.deals) {
      const rep = repNameById.get(d.rep_id) ?? "Unknown";
      const stage = normalizeStage(d.stage);
      const key = `${rep}__${stage}`;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    const cells = reps.flatMap((rep) =>
      stages.map((stage) => ({
        rep,
        stage,
        count: countMap.get(`${rep}__${stage}`) ?? 0,
      }))
    );

    return res.json({
      status: "ok",
      heatmap: { reps, stages, cells },
    });
  } catch (err) {
    return next(err);
  }
};
