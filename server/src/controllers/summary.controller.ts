import type { Request, Response, NextFunction } from "express";
import { cleanStore } from "../store";

// ---------- helpers ----------
function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthStartUTC(year: number, month1to12: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, 1));
}

function addMonthsUTC(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
}

function endOfMonthUTC(year: number, month1to12: number): Date {
  return new Date(Date.UTC(year, month1to12, 0, 23, 59, 59, 999));
}

function getQuarterFromMonth(month1to12: number): 1 | 2 | 3 | 4 {
  return (Math.floor((month1to12 - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

function safePctChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------- controller ----------
export const getSummary = (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1) Determine "current quarter" from latest target month (YYYY-MM)
    const latestMonth = cleanStore.targets.reduce(
      (max, t) => (t.month > max ? t.month : max),
      "0000-00"
    );

    const [yStr, mStr] = latestMonth.split("-");
    const year = Number(yStr);
    const month = Number(mStr);

    const q = getQuarterFromMonth(month);
    const qStartMonth = (q - 1) * 3 + 1; // 1,4,7,10
    const qMonths = [qStartMonth, qStartMonth + 1, qStartMonth + 2];

    const quarterStart = monthStartUTC(year, qStartMonth);
    const quarterEnd = endOfMonthUTC(year, qStartMonth + 2);

    // 2) Revenue for the quarter = sum(amount) of Closed Won deals with closed_at in quarter
    let quarterRevenue = 0;

    for (const d of cleanStore.deals) {
      if (d.stage !== "Closed Won") continue;

      const closedAt = parseDate(d.closed_at);
      if (!closedAt) continue;

      if (closedAt >= quarterStart && closedAt <= quarterEnd) {
        // after cleaning: amount is number | null
        quarterRevenue += d.amount ?? 0;
      }
    }

    // 3) Target for quarter = sum targets for those 3 months
    let quarterTarget = 0;
    for (const m of qMonths) {
      const key = `${year}-${String(m).padStart(2, "0")}`; // YYYY-MM
      quarterTarget += cleanStore.targetsByMonth.get(key) ?? 0;
    }

    // 4) Gap (%) = (revenue - target) / target * 100
    const gap = quarterRevenue - quarterTarget;
    const gapPct = quarterTarget === 0 ? null : (gap / quarterTarget) * 100;

    // 5) QoQ change
    const prevQuarterStart = addMonthsUTC(quarterStart, -3);
    const prevQuarterEnd = new Date(quarterStart.getTime() - 1);

    let prevQuarterRevenue = 0;
    for (const d of cleanStore.deals) {
      if (d.stage !== "Closed Won") continue;

      const closedAt = parseDate(d.closed_at);
      if (!closedAt) continue;

      if (closedAt >= prevQuarterStart && closedAt <= prevQuarterEnd) {
        prevQuarterRevenue += d.amount ?? 0;
      }
    }

    const qoqChangePct = safePctChange(quarterRevenue, prevQuarterRevenue);

    return res.json({
      status: "ok",
      summary: {
        currentQuarter: `Q${q} ${year}`,
        period: {
          start: quarterStart.toISOString().slice(0, 10),
          end: quarterEnd.toISOString().slice(0, 10),
        },
        revenue: round2(quarterRevenue),
        target: round2(quarterTarget),
        gap: round2(gap),
        gapPct: gapPct === null ? null : round2(gapPct),
        change: {
          type: "QoQ",
          prevQuarterRevenue: round2(prevQuarterRevenue),
          changePct: qoqChangePct === null ? null : round2(qoqChangePct),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};
