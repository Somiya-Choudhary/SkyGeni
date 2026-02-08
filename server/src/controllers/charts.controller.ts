import type { Request, Response, NextFunction } from "express";
import { cleanStore } from "../store";

type Point = { month: string; value: number };

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKeyFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthKeyFromString(yyyyMmDd: string): string {
  return yyyyMmDd.slice(0, 7); // YYYY-MM
}

function lastNMonthsKeys(endMonthKey: string, months: number): string[] {
  const [yStr, mStr] = endMonthKey.split("-");
  let y = Number(yStr);
  let m = Number(mStr); // 1..12

  const keys: string[] = [];
  for (let i = 0; i < months; i++) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  keys.reverse();
  return keys;
}

function latestMonthInTargets(): string {
  return cleanStore.targets.reduce((max, t) => (t.month > max ? t.month : max), "0000-00");
}

/**
 * 1) Pipeline value by month = sum(amount) of OPEN deals created in that month
 */
export const getPipelineByMonth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const months = clampInt(req.query.months, 12, 3, 36);
    const endMonth = String(req.query.endMonth ?? latestMonthInTargets()); // YYYY-MM

    const keys = lastNMonthsKeys(endMonth, months);
    const sums = new Map<string, number>(keys.map(k => [k, 0]));

    for (const d of cleanStore.deals) {
      const isClosed = d.stage === "Closed Won" || d.stage === "Closed Lost";
      if (isClosed) continue;

      const month = monthKeyFromString(d.created_at);
      if (!sums.has(month)) continue;

      sums.set(month, (sums.get(month) ?? 0) + (d.amount ?? 0));
    }

    const points: Point[] = keys.map(month => ({ month, value: Math.round((sums.get(month) ?? 0) * 100) / 100 }));
    return res.json({ status: "ok", series: points });
  } catch (err) {
    return next(err);
  }
};

/**
 * 2) Win rate by month = Won/(Won+Lost) for deals CLOSED in that month
 * returns value between 0..1
 */
export const getWinRateByMonth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const months = clampInt(req.query.months, 12, 3, 36);
    const endMonth = String(req.query.endMonth ?? latestMonthInTargets());

    const keys = lastNMonthsKeys(endMonth, months);
    const won = new Map<string, number>(keys.map(k => [k, 0]));
    const lost = new Map<string, number>(keys.map(k => [k, 0]));

    for (const d of cleanStore.deals) {
      const isWon = d.stage === "Closed Won";
      const isLost = d.stage === "Closed Lost";
      if (!isWon && !isLost) continue;

      const closedAt = parseDate(d.closed_at);
      if (!closedAt) continue;

      const month = monthKeyFromDate(closedAt);
      if (!won.has(month)) continue;

      if (isWon) won.set(month, (won.get(month) ?? 0) + 1);
      if (isLost) lost.set(month, (lost.get(month) ?? 0) + 1);
    }

    const points: Point[] = keys.map(month => {
      const w = won.get(month) ?? 0;
      const l = lost.get(month) ?? 0;
      const denom = w + l;
      return { month, value: denom === 0 ? 0 : w / denom };
    });

    return res.json({ status: "ok", series: points });
  } catch (err) {
    return next(err);
  }
};

/**
 * 3) Avg sales cycle (days) by month = mean(closed_at - created_at) for closed deals closed that month
 */
export const getSalesCycleByMonth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const months = clampInt(req.query.months, 12, 3, 36);
    const endMonth = String(req.query.endMonth ?? latestMonthInTargets());

    const keys = lastNMonthsKeys(endMonth, months);
    const sumDays = new Map<string, number>(keys.map(k => [k, 0]));
    const counts = new Map<string, number>(keys.map(k => [k, 0]));

    for (const d of cleanStore.deals) {
      const isClosed = d.stage === "Closed Won" || d.stage === "Closed Lost";
      if (!isClosed) continue;

      const createdAt = parseDate(d.created_at);
      const closedAt = parseDate(d.closed_at);
      if (!createdAt || !closedAt) continue;

      const month = monthKeyFromDate(closedAt);
      if (!sumDays.has(month)) continue;

      const days = (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (!Number.isFinite(days) || days < 0) continue;

      sumDays.set(month, (sumDays.get(month) ?? 0) + days);
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }

    const points: Point[] = keys.map(month => {
      const c = counts.get(month) ?? 0;
      const s = sumDays.get(month) ?? 0;
      return { month, value: c === 0 ? 0 : Math.round((s / c) * 100) / 100 };
    });

    return res.json({ status: "ok", series: points });
  } catch (err) {
    return next(err);
  }
};

/**
 * 4) Avg deal size by month = mean(amount>0) of deals CREATED that month (unique deals already cleaned)
 */
export const getAvgDealSizeByMonth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const months = clampInt(req.query.months, 12, 3, 36);
    const endMonth = String(req.query.endMonth ?? latestMonthInTargets());

    const keys = lastNMonthsKeys(endMonth, months);
    const sum = new Map<string, number>(keys.map(k => [k, 0]));
    const cnt = new Map<string, number>(keys.map(k => [k, 0]));

    for (const d of cleanStore.deals) {
      const month = monthKeyFromString(d.created_at);
      if (!sum.has(month)) continue;

      const amt = d.amount ?? 0;
      if (amt <= 0) continue;

      sum.set(month, (sum.get(month) ?? 0) + amt);
      cnt.set(month, (cnt.get(month) ?? 0) + 1);
    }

    const points: Point[] = keys.map(month => {
      const c = cnt.get(month) ?? 0;
      const s = sum.get(month) ?? 0;
      return { month, value: c === 0 ? 0 : Math.round((s / c) * 100) / 100 };
    });

    return res.json({ status: "ok", series: points });
  } catch (err) {
    return next(err);
  }
};

export const getRevenueByMonth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const months = clampInt(req.query.months, 6, 3, 36);
    const endMonth = String(req.query.endMonth ?? latestMonthInTargets());

    const keys = lastNMonthsKeys(endMonth, months);
    const sums = new Map<string, number>(keys.map((k) => [k, 0]));

    // Revenue = Closed Won only, grouped by CLOSED month
    for (const d of cleanStore.deals) {
      if (d.stage !== "Closed Won") continue;

      const closedAt = parseDate(d.closed_at);
      if (!closedAt) continue;

      const month = monthKeyFromDate(closedAt);
      if (!sums.has(month)) continue;

      sums.set(month, (sums.get(month) ?? 0) + (d.amount ?? 0));
    }

    const points = keys.map((month) => ({
      month,
      value: Math.round((sums.get(month) ?? 0) * 100) / 100,
    }));

    return res.json({ status: "ok", series: points });
  } catch (err) {
    return next(err);
  }
};
