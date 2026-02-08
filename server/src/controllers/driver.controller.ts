import type { Request, Response, NextFunction } from "express";
import { store } from "../store";

// ---------- helpers ----------
function parseDate(s: string | null): Date | null {
  if (!s) return null;
  return new Date(`${s}T00:00:00.000Z`);
}

function monthStartUTC(year: number, month1to12: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, 1));
}

function endOfMonthUTC(year: number, month1to12: number): Date {
  return new Date(Date.UTC(year, month1to12, 0, 23, 59, 59, 999));
}

function addMonthsUTC(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
}

function getQuarterFromMonth(month1to12: number): 1 | 2 | 3 | 4 {
  return (Math.floor((month1to12 - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

// Computes metrics for a quarter window
function computeDrivers(quarterStart: Date, quarterEnd: Date) {
  // Pipeline: open deals created in quarter
  let pipelineSize = 0;
  let pipelineCount = 0;

  // Closed deals in quarter (by closed_at)
  let closedWonCount = 0;
  let closedLostCount = 0;

  const wonAmounts: number[] = [];
  const cycleDays: number[] = [];

  for (const d of store.deals) {
    const createdAt = parseDate(d.created_at);
    const closedAt = parseDate(d.closed_at);

    const amount = typeof d.amount === "number" ? d.amount : 0;

    // Pipeline: stage NOT closed, created within quarter
    if (createdAt && createdAt >= quarterStart && createdAt <= quarterEnd) {
      const isClosed = d.stage === "Closed Won" || d.stage === "Closed Lost";
      if (!isClosed) {
        pipelineSize += amount;
        pipelineCount += 1;
      }
    }

    // Closed metrics: closed_at inside quarter
    if (closedAt && closedAt >= quarterStart && closedAt <= quarterEnd) {
      if (d.stage === "Closed Won") {
        closedWonCount += 1;
        wonAmounts.push(amount);
      } else if (d.stage === "Closed Lost") {
        closedLostCount += 1;
      }

      // Sales cycle days for any closed deal if we have created_at
      if (createdAt) {
        const dDays = daysBetween(createdAt, closedAt);
        // guard against weird negative data
        if (Number.isFinite(dDays) && dDays >= 0) cycleDays.push(dDays);
      }
    }
  }

  const totalClosed = closedWonCount + closedLostCount;
  const winRate = totalClosed === 0 ? null : (closedWonCount / totalClosed) * 100;

  const avgDealSize = avg(wonAmounts); // Closed Won avg
  const avgSalesCycleDays = avg(cycleDays);

  return {
    pipeline: { amount: round2(pipelineSize), count: pipelineCount },
    winRatePct: winRate === null ? null : round2(winRate),
    avgDealSize: avgDealSize === null ? null : round2(avgDealSize),
    salesCycleDays: avgSalesCycleDays === null ? null : round2(avgSalesCycleDays),
    _debug: { closedWonCount, closedLostCount, totalClosed }, // keep/remove as you like
  };
}

export const getDrivers = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Decide "current quarter" based on latest target month (since your dataset is a fixed year)
    const latestMonth = store.targets.reduce(
      (max, t) => (t.month > max ? t.month : max),
      "0000-00"
    );

    const [yStr, mStr] = latestMonth.split("-");
    const year = Number(yStr);
    const month = Number(mStr);

    const q = getQuarterFromMonth(month);
    const qStartMonth = (q - 1) * 3 + 1;

    const curStart = monthStartUTC(year, qStartMonth);
    const curEnd = endOfMonthUTC(year, qStartMonth + 2);

    const prevStart = addMonthsUTC(curStart, -3);
    const prevEnd = new Date(curStart.getTime() - 1);

    const current = computeDrivers(curStart, curEnd);
    const previous = computeDrivers(prevStart, prevEnd);

    // deltas (current vs previous)
    const pipelineDeltaPct = pct(current.pipeline.amount, previous.pipeline.amount);
    const winRateDelta = (current.winRatePct === null || previous.winRatePct === null)
      ? null
      : round2(current.winRatePct - previous.winRatePct);

    const avgDealSizeDeltaPct =
      current.avgDealSize === null || previous.avgDealSize === null
        ? null
        : pct(current.avgDealSize, previous.avgDealSize);

    const cycleDeltaPct =
      current.salesCycleDays === null || previous.salesCycleDays === null
        ? null
        : pct(current.salesCycleDays, previous.salesCycleDays);

    return res.json({
      status: "ok",
      drivers: {
        currentQuarter: `Q${q} ${year}`,
        period: {
          start: curStart.toISOString().slice(0, 10),
          end: curEnd.toISOString().slice(0, 10),
        },
        current: {
          pipelineSize: current.pipeline,             // { amount, count }
          winRatePct: current.winRatePct,             // %
          averageDealSize: current.avgDealSize,        // $
          salesCycleDays: current.salesCycleDays,      // days
        },
        previous: {
          period: {
            start: prevStart.toISOString().slice(0, 10),
            end: prevEnd.toISOString().slice(0, 10),
          },
          pipelineSize: previous.pipeline,
          winRatePct: previous.winRatePct,
          averageDealSize: previous.avgDealSize,
          salesCycleDays: previous.salesCycleDays,
        },
        deltas: {
          pipelineAmountPct: pipelineDeltaPct === null ? null : round2(pipelineDeltaPct),
          winRatePoints: winRateDelta, // percentage points (e.g., +4.2)
          averageDealSizePct: avgDealSizeDeltaPct === null ? null : round2(avgDealSizeDeltaPct),
          salesCycleDaysPct: cycleDeltaPct === null ? null : round2(cycleDeltaPct),
        },
        interpretation: [
          "Pipeline size uses open deals created this quarter (good proxy for near-term revenue).",
          "Win rate uses deals closed this quarter (Closed Won / (Won+Lost)).",
          "Avg deal size uses Closed Won amounts closed this quarter.",
          "Sales cycle is avg days from created_at to closed_at for closed deals this quarter.",
        ],
      },
    });
  } catch (err) {
    return next(err);
  }
};
