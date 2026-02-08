import type { Request, Response, NextFunction } from "express";
import { cleanStore } from "../store";

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function norm(s: string | null | undefined) {
  const v = (s ?? "").trim();
  return v.length ? v : "Unknown";
}

export const getSegmentStageIndustry = (req: Request, res: Response, next: NextFunction) => {
  try {
    const topIndustries = clampInt(req.query.topIndustries, 4, 2, 10);
    const segment = String(req.query.segment ?? "").trim();

    const acctById = new Map(cleanStore.accounts.map((a) => [a.account_id, a]));

    // Join clean deals with accounts
    const joined = cleanStore.deals
      .map((d) => {
        const a = acctById.get(d.account_id);
        if (!a) return null;
        return { stage: norm(d.stage), segment: norm(a.segment), industry: norm(a.industry) };
      })
      .filter((x): x is { stage: string; segment: string; industry: string } => !!x);

    const segments = Array.from(new Set(joined.map((x) => x.segment))).sort();
    const chosenSegment = segment || segments[0] || "Unknown";

    const filtered = joined.filter((x) => x.segment === chosenSegment);

    const stages = Array.from(new Set(filtered.map((x) => x.stage))).sort();

    // Top industries in segment
    const industryCounts = new Map<string, number>();
    for (const r of filtered) {
      industryCounts.set(r.industry, (industryCounts.get(r.industry) ?? 0) + 1);
    }
    const industries = Array.from(industryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topIndustries)
      .map(([k]) => k);

    // Count per (stage, industry)
    const countMap = new Map<string, number>();
    for (const r of filtered) {
      if (!industries.includes(r.industry)) continue;
      const key = `${r.stage}__${r.industry}`;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    const series = stages.map((stage) => ({
      stage,
      values: industries.map((ind) => ({
        industry: ind,
        count: countMap.get(`${stage}__${ind}`) ?? 0,
      })),
    }));

    return res.json({
      status: "ok",
      segmentStageIndustry: {
        segment: chosenSegment,
        segments,
        stages,
        industries,
        series,
      },
    });
  } catch (err) {
    return next(err);
  }
};
