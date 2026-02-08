import type { Request, Response, NextFunction } from "express";
import { cleanStore } from "../store";

/**
 * Risk Factors - /api/risk-factors
 * Identify:
 * 1) Stale deals: Open deals with no activity in last N days (default 14) AND older than M days (default 30)
 * 2) Underperforming reps: Reps with low win-rate and/or low closed-won revenue in current quarter
 * 3) Low activity accounts: Accounts with very few activities in last N days (default 30)
 *
 * Notes:
 * - Uses cleaned in-memory data: cleanStore.*
 * - "Current quarter" is derived from latest target month in targets.json (since dataset is for a fixed year)
 */

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthStartUTC(year: number, month1to12: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, 1));
}

function endOfMonthUTC(year: number, month1to12: number): Date {
  return new Date(Date.UTC(year, month1to12, 0, 23, 59, 59, 999));
}

function getQuarterFromMonth(month1to12: number): 1 | 2 | 3 | 4 {
  return (Math.floor((month1to12 - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

function daysAgo(d: Date, days: number): Date {
  return new Date(d.getTime() - days * 24 * 60 * 60 * 1000);
}

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

type DealRisk = {
  dealId: string;
  accountId: string;
  accountName: string | null;
  repId: string;
  repName: string | null;
  stage: string;
  amount: number | null;
  createdAt: string;
  lastActivityAt: string | null;
  daysSinceLastActivity: number | null;
  daysOpen: number;
};

type RepRisk = {
  repId: string;
  repName: string | null;
  winRatePct: number | null;
  closedWonCount: number;
  closedLostCount: number;
  closedWonRevenue: number;
  pipelineOpenAmount: number;
};

type AccountRisk = {
  accountId: string;
  accountName: string | null;
  industry: string | null;
  segment: string | null;
  activitiesLastNDays: number;
  lastActivityAt: string | null;
  openDealsCount: number;
  openDealsAmount: number;
};

export const riskFactor = (req: Request, res: Response, next: NextFunction) => {
  try {
    // --------- configurable thresholds (via query params) ----------
    const staleNoActivityDays = clampInt(req.query.staleNoActivityDays, 14, 1, 180); // N
    const staleMinAgeDays = clampInt(req.query.staleMinAgeDays, 30, 1, 365); // M
    const lowActivityWindowDays = clampInt(req.query.lowActivityWindowDays, 30, 7, 365);
    const lowActivityMaxCount = clampInt(req.query.lowActivityMaxCount, 1, 0, 50); // <= this is low activity
    const topN = clampInt(req.query.limit, 10, 1, 50);

    // "Now" for analysis:
    // If you prefer to anchor to dataset end, we’ll use end-of-quarter as "now".
    const latestMonth = cleanStore.targets.reduce(
      (max, t) => (t.month > max ? t.month : max),
      "0000-00"
    );
    const [yStr, mStr] = latestMonth.split("-");
    const year = Number(yStr);
    const month = Number(mStr);

    const q = getQuarterFromMonth(month);
    const qStartMonth = (q - 1) * 3 + 1;
    const quarterStart = monthStartUTC(year, qStartMonth);
    const quarterEnd = endOfMonthUTC(year, qStartMonth + 2);

    // Anchor "now" to quarterEnd (more consistent for a static dataset)
    const now = quarterEnd;

    // ----------------- build quick indexes -----------------
    // last activity per deal + activity counts per account within N days
    const lastActivityByDealId = new Map<string, Date>();
    const activityCountByAccountInWindow = new Map<string, number>();
    const lastActivityByAccountId = new Map<string, Date>();

    const activityWindowStart = daysAgo(now, lowActivityWindowDays);

    // We need deal->account mapping for activity->account rollups
    const dealById = cleanStore.dealsById;

    for (const a of cleanStore.activities) {
      const ts = parseDate(a.timestamp);
      if (!ts) continue;

      // last activity by deal
      const prev = lastActivityByDealId.get(a.deal_id);
      if (!prev || ts > prev) lastActivityByDealId.set(a.deal_id, ts);

      // activity stats per account (only if we can resolve deal->account)
      if (ts >= activityWindowStart && ts <= now) {
        const deal = dealById.get(a.deal_id);
        if (deal) {
          const accountId = deal.account_id;
          activityCountByAccountInWindow.set(
            accountId,
            (activityCountByAccountInWindow.get(accountId) ?? 0) + 1
          );

          const prevAcc = lastActivityByAccountId.get(accountId);
          if (!prevAcc || ts > prevAcc) lastActivityByAccountId.set(accountId, ts);
        }
      }
    }

    // ----------------- 1) Stale deals -----------------
    const staleCutoffActivity = daysAgo(now, staleNoActivityDays);
    const staleMinCreatedBefore = daysAgo(now, staleMinAgeDays);

    const staleDeals: DealRisk[] = [];

    for (const d of cleanStore.deals) {
      // stale deals = OPEN deals
      const isClosed = d.stage === "Closed Won" || d.stage === "Closed Lost";
      if (isClosed) continue;

      const createdAt = parseDate(d.created_at);
      if (!createdAt) continue;

      // must be older than M days
      if (createdAt > staleMinCreatedBefore) continue;

      const lastAct = lastActivityByDealId.get(d.deal_id) ?? null;

      // no activity in last N days (or no activity at all)
      if (lastAct && lastAct > staleCutoffActivity) continue;

      const account = cleanStore.accountsById.get(d.account_id) ?? null;
      const rep = cleanStore.repsById.get(d.rep_id) ?? null;

      const daysOpen = Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
      const daysSinceLast = lastAct
        ? Math.floor((now.getTime() - lastAct.getTime()) / (24 * 60 * 60 * 1000))
        : null;

      staleDeals.push({
        dealId: d.deal_id,
        accountId: d.account_id,
        accountName: account?.name ?? null,
        repId: d.rep_id,
        repName: rep?.name ?? null,
        stage: d.stage,
        amount: d.amount ?? null,
        createdAt: d.created_at,
        lastActivityAt: lastAct ? lastAct.toISOString().slice(0, 10) : null,
        daysSinceLastActivity: daysSinceLast,
        daysOpen,
      });
    }

    // Sort: most stale first (no activity first, then biggest daysSinceLast, then biggest amount)
    staleDeals.sort((a, b) => {
      const aNo = a.daysSinceLastActivity === null ? 1 : 0;
      const bNo = b.daysSinceLastActivity === null ? 1 : 0;
      if (aNo !== bNo) return bNo - aNo;
      const aStale = a.daysSinceLastActivity ?? -1;
      const bStale = b.daysSinceLastActivity ?? -1;
      if (aStale !== bStale) return bStale - aStale;
      const aAmt = a.amount ?? 0;
      const bAmt = b.amount ?? 0;
      return bAmt - aAmt;
    });

    const staleDealsTop = staleDeals.slice(0, topN);

    // ----------------- 2) Underperforming reps -----------------
    // We'll compute rep stats for current quarter:
    // - win rate: deals closed in quarter (won / (won+lost))
    // - revenue: sum closed-won amounts in quarter
    // - pipeline open amount: open deals (anytime) amount as of "now" (proxy)
    const repStats = new Map<
      string,
      { won: number; lost: number; wonRevenue: number; pipelineOpen: number }
    >();

    for (const r of cleanStore.reps) {
      repStats.set(r.rep_id, { won: 0, lost: 0, wonRevenue: 0, pipelineOpen: 0 });
    }

    for (const d of cleanStore.deals) {
      const stats = repStats.get(d.rep_id) ?? { won: 0, lost: 0, wonRevenue: 0, pipelineOpen: 0 };
      repStats.set(d.rep_id, stats);

      const amt = d.amount ?? 0;

      const isClosedWon = d.stage === "Closed Won";
      const isClosedLost = d.stage === "Closed Lost";
      const isClosed = isClosedWon || isClosedLost;

      // pipeline open (as of now)
      if (!isClosed) stats.pipelineOpen += amt;

      // closed in quarter
      if (isClosed) {
        const closedAt = parseDate(d.closed_at);
        if (closedAt && closedAt >= quarterStart && closedAt <= quarterEnd) {
          if (isClosedWon) {
            stats.won += 1;
            stats.wonRevenue += amt;
          } else if (isClosedLost) {
            stats.lost += 1;
          }
        }
      }
    }

    const repRisks: RepRisk[] = [];
    for (const rep of cleanStore.reps) {
      const s = repStats.get(rep.rep_id) ?? { won: 0, lost: 0, wonRevenue: 0, pipelineOpen: 0 };
      const totalClosed = s.won + s.lost;
      const winRate = totalClosed === 0 ? null : (s.won / totalClosed) * 100;

      repRisks.push({
        repId: rep.rep_id,
        repName: rep.name ?? null,
        winRatePct: winRate === null ? null : Math.round(winRate * 100) / 100,
        closedWonCount: s.won,
        closedLostCount: s.lost,
        closedWonRevenue: Math.round(s.wonRevenue * 100) / 100,
        pipelineOpenAmount: Math.round(s.pipelineOpen * 100) / 100,
      });
    }

    // Underperforming definition:
    // - If rep has at least 3 closed deals in quarter, and winRate < 30%
    // - OR rep has 0 won revenue but has pipeline open (stuck)
    const underperformingReps = repRisks
      .filter(r => {
        const totalClosed = r.closedWonCount + r.closedLostCount;
        const lowWinRate = totalClosed >= 3 && (r.winRatePct ?? 100) < 30;
        const noWinsButPipeline = r.closedWonRevenue === 0 && r.pipelineOpenAmount > 0;
        return lowWinRate || noWinsButPipeline;
      })
      // Sort: lowest win rate first, then lowest revenue
      .sort((a, b) => {
        const aw = a.winRatePct ?? 101;
        const bw = b.winRatePct ?? 101;
        if (aw !== bw) return aw - bw;
        return a.closedWonRevenue - b.closedWonRevenue;
      })
      .slice(0, topN);

    // ----------------- 3) Low activity accounts -----------------
    // For each account:
    // - activities count in last N days
    // - last activity timestamp (in that window)
    // - open deals count + amount
    const openDealsByAccount = new Map<string, { count: number; amount: number }>();
    for (const d of cleanStore.deals) {
      const isClosed = d.stage === "Closed Won" || d.stage === "Closed Lost";
      if (isClosed) continue;

      const prev = openDealsByAccount.get(d.account_id) ?? { count: 0, amount: 0 };
      prev.count += 1;
      prev.amount += d.amount ?? 0;
      openDealsByAccount.set(d.account_id, prev);
    }

    const lowActivityAccounts: AccountRisk[] = [];

    for (const acc of cleanStore.accounts) {
      const cnt = activityCountByAccountInWindow.get(acc.account_id) ?? 0;
      if (cnt > lowActivityMaxCount) continue;

      const lastAccAct = lastActivityByAccountId.get(acc.account_id) ?? null;
      const open = openDealsByAccount.get(acc.account_id) ?? { count: 0, amount: 0 };

      // optional: only flag if they actually have open deals (otherwise it's just "quiet account")
      // if (open.count === 0) continue;

      lowActivityAccounts.push({
        accountId: acc.account_id,
        accountName: acc.name ?? null,
        industry: (acc as any).industry ?? null,
        segment: (acc as any).segment ?? null,
        activitiesLastNDays: cnt,
        lastActivityAt: lastAccAct ? lastAccAct.toISOString().slice(0, 10) : null,
        openDealsCount: open.count,
        openDealsAmount: Math.round(open.amount * 100) / 100,
      });
    }

    // Sort: accounts with open pipeline first (more risky), then lowest activity, then bigger pipeline
    lowActivityAccounts.sort((a, b) => {
      if (a.openDealsCount !== b.openDealsCount) return b.openDealsCount - a.openDealsCount;
      if (a.activitiesLastNDays !== b.activitiesLastNDays) return a.activitiesLastNDays - b.activitiesLastNDays;
      return b.openDealsAmount - a.openDealsAmount;
    });

    const lowActivityAccountsTop = lowActivityAccounts.slice(0, topN);

    return res.json({
      status: "ok",
      riskFactors: {
        currentQuarter: `Q${q} ${year}`,
        period: {
          start: quarterStart.toISOString().slice(0, 10),
          end: quarterEnd.toISOString().slice(0, 10),
        },
        parameters: {
          staleNoActivityDays,
          staleMinAgeDays,
          lowActivityWindowDays,
          lowActivityMaxCount,
          limit: topN,
          analysisNow: now.toISOString().slice(0, 10),
        },
        staleDeals: {
          count: staleDeals.length,
          top: staleDealsTop,
        },
        underperformingReps: {
          count: underperformingReps.length,
          top: underperformingReps,
        },
        lowActivityAccounts: {
          count: lowActivityAccounts.length,
          top: lowActivityAccountsTop,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};
