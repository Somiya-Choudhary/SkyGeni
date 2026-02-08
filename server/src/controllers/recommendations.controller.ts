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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type Recommendation = {
  id: string;
  title: string;
  message: string;
  why: string;
  impact: "high" | "medium" | "low";
  metricHint?: { key: string; value: number | string | null };
  filters?: Record<string, string | number>;
};

// ---------- controller ----------
export const getRecommendations = (req: Request, res: Response, next: NextFunction) => {
  try {
    const staleNoActivityDays = clampInt(req.query.staleNoActivityDays, 14, 1, 180);
    const staleMinAgeDays = clampInt(req.query.staleMinAgeDays, 30, 1, 365);
    const lowActivityWindowDays = clampInt(req.query.lowActivityWindowDays, 30, 7, 365);
    const lowActivityMaxCount = clampInt(req.query.lowActivityMaxCount, 1, 0, 50);

    // Determine "current quarter" from latest target month (static dataset)
    const latestMonth = cleanStore.targets.reduce((max, t) => (t.month > max ? t.month : max), "0000-00");
    const [yStr, mStr] = latestMonth.split("-");
    const year = Number(yStr);
    const month = Number(mStr);
    const q = getQuarterFromMonth(month);

    const qStartMonth = (q - 1) * 3 + 1;
    const quarterStart = monthStartUTC(year, qStartMonth);
    const quarterEnd = endOfMonthUTC(year, qStartMonth + 2);

    // Anchor "now" to end of quarter (consistent for fixed year data)
    const now = quarterEnd;

    // -------------------
    // Build indexes needed
    // -------------------
    // last activity per deal
    const lastActivityByDealId = new Map<string, Date>();
    // activity count per account in last N days
    const activityCountByAccount = new Map<string, number>();

    const activityWindowStart = daysAgo(now, lowActivityWindowDays);
    const dealById = cleanStore.dealsById;

    for (const a of cleanStore.activities) {
      const ts = parseDate(a.timestamp);
      if (!ts) continue;

      const prev = lastActivityByDealId.get(a.deal_id);
      if (!prev || ts > prev) lastActivityByDealId.set(a.deal_id, ts);

      if (ts >= activityWindowStart && ts <= now) {
        const deal = dealById.get(a.deal_id);
        if (deal) {
          const accId = deal.account_id;
          activityCountByAccount.set(accId, (activityCountByAccount.get(accId) ?? 0) + 1);
        }
      }
    }

    // -------------------
    // 1) Focus: Enterprise open deals older than X days and stale
    // -------------------
    const staleCutoffActivity = daysAgo(now, staleNoActivityDays);
    const staleMinCreatedBefore = daysAgo(now, staleMinAgeDays);

    let enterpriseStaleCount = 0;
    let enterpriseStaleAmount = 0;

    for (const d of cleanStore.deals) {
      const isClosed = d.stage === "Closed Won" || d.stage === "Closed Lost";
      if (isClosed) continue;

      const acc = cleanStore.accountsById.get(d.account_id);
      if (!acc) continue;

      // segment check (Enterprise)
      const segment = (acc.segment ?? "").toLowerCase();
      if (!segment.includes("enterprise")) continue;

      const createdAt = parseDate(d.created_at);
      if (!createdAt || createdAt > staleMinCreatedBefore) continue;

      const lastAct = lastActivityByDealId.get(d.deal_id) ?? null;
      if (lastAct && lastAct > staleCutoffActivity) continue;

      enterpriseStaleCount += 1;
      enterpriseStaleAmount += d.amount ?? 0;
    }

    // -------------------
    // 2) Coach rep with low win-rate in current quarter
    // -------------------
    const repStats = new Map<string, { won: number; lost: number; wonRevenue: number }>();
    for (const r of cleanStore.reps) repStats.set(r.rep_id, { won: 0, lost: 0, wonRevenue: 0 });

    for (const d of cleanStore.deals) {
      const isWon = d.stage === "Closed Won";
      const isLost = d.stage === "Closed Lost";
      if (!isWon && !isLost) continue;

      const closedAt = parseDate(d.closed_at);
      if (!closedAt || closedAt < quarterStart || closedAt > quarterEnd) continue;

      const s = repStats.get(d.rep_id) ?? { won: 0, lost: 0, wonRevenue: 0 };
      if (isWon) {
        s.won += 1;
        s.wonRevenue += d.amount ?? 0;
      } else {
        s.lost += 1;
      }
      repStats.set(d.rep_id, s);
    }

    let worstRepId: string | null = null;
    let worstRepWinRate: number | null = null;
    let worstRepClosed: number = 0;

    for (const [repId, s] of repStats.entries()) {
      const total = s.won + s.lost;
      if (total < 3) continue; // require enough sample
      const winRate = (s.won / total) * 100;

      if (worstRepWinRate === null || winRate < worstRepWinRate) {
        worstRepWinRate = winRate;
        worstRepId = repId;
        worstRepClosed = total;
      }
    }

    const worstRep = worstRepId ? cleanStore.repsById.get(worstRepId) ?? null : null;

    // -------------------
    // 3) Increase activity for lowest-activity segment (e.g., Segment B)
    // -------------------
    const segmentStats = new Map<string, { accounts: number; activities: number; openAmount: number }>();

    // open pipeline per account
    const openAmountByAccount = new Map<string, number>();
    for (const d of cleanStore.deals) {
      const isClosed = d.stage === "Closed Won" || d.stage === "Closed Lost";
      if (isClosed) continue;
      openAmountByAccount.set(d.account_id, (openAmountByAccount.get(d.account_id) ?? 0) + (d.amount ?? 0));
    }

    for (const acc of cleanStore.accounts) {
      const seg = (acc.segment ?? "Unknown").trim() || "Unknown";
      const act = activityCountByAccount.get(acc.account_id) ?? 0;
      const openAmt = openAmountByAccount.get(acc.account_id) ?? 0;

      const s = segmentStats.get(seg) ?? { accounts: 0, activities: 0, openAmount: 0 };
      s.accounts += 1;
      s.activities += act;
      s.openAmount += openAmt;
      segmentStats.set(seg, s);
    }

    // find segment with lowest activities per account among segments with meaningful open pipeline
    let worstSeg: { name: string; actPerAcc: number; openAmount: number } | null = null;
    for (const [seg, s] of segmentStats.entries()) {
      if (s.accounts === 0) continue;
      const actPerAcc = s.activities / s.accounts;
      // only consider if they have pipeline to care about
      if (s.openAmount <= 0) continue;

      if (!worstSeg || actPerAcc < worstSeg.actPerAcc) {
        worstSeg = { name: seg, actPerAcc, openAmount: s.openAmount };
      }
    }

    // -------------------
    // 4) Deal hygiene: follow up on "Negotiation" deals with no activity
    // -------------------
    let negotiationStaleCount = 0;
    let negotiationStaleAmount = 0;
    for (const d of cleanStore.deals) {
      if (d.stage.toLowerCase() !== "negotiation") continue;

      const isClosed = d.stage === "Closed Won" || d.stage === "Closed Lost";
      if (isClosed) continue;

      const lastAct = lastActivityByDealId.get(d.deal_id) ?? null;
      if (lastAct && lastAct > staleCutoffActivity) continue;

      negotiationStaleCount += 1;
      negotiationStaleAmount += d.amount ?? 0;
    }

    // -------------------
    // Build recommendations (3–5)
    // -------------------
    const recs: Recommendation[] = [];

    if (enterpriseStaleCount > 0) {
      recs.push({
        id: "rec_enterprise_stale",
        title: `Focus on Enterprise deals older than ${staleMinAgeDays} days`,
        message: `You have ${enterpriseStaleCount} Enterprise open deals with no activity in the last ${staleNoActivityDays} days.`,
        why: "Enterprise deals usually carry higher ACV—unsticking a few can move the quarter.",
        impact: "high",
        metricHint: { key: "enterpriseStalePipeline", value: round2(enterpriseStaleAmount) },
        filters: { segment: "Enterprise", minAgeDays: staleMinAgeDays, noActivityDays: staleNoActivityDays },
      });
    }

    if (worstRep && worstRepWinRate !== null) {
      recs.push({
        id: "rec_coach_rep",
        title: `Coach ${worstRep.name} on win rate`,
        message: `${worstRep.name} has the lowest win rate in the current quarter (${round2(
          worstRepWinRate
        )}%) across reps with ≥3 closed deals (${worstRepClosed} closed).`,
        why: "Small improvements in qualification/objection handling can increase conversion quickly.",
        impact: "high",
        metricHint: { key: "repWinRatePct", value: round2(worstRepWinRate) },
        filters: { repId: worstRep.rep_id, quarter: `Q${q} ${year}` },
      });
    }

    if (worstSeg) {
      recs.push({
        id: "rec_increase_activity_segment",
        title: `Increase activity for segment "${worstSeg.name}"`,
        message: `This segment has the lowest activity rate (~${round2(
          worstSeg.actPerAcc
        )} activities/account in last ${lowActivityWindowDays} days) while still holding open pipeline.`,
        why: "More touches (calls/emails) usually improves progression and reduces slippage.",
        impact: "medium",
        metricHint: { key: "segmentOpenPipeline", value: round2(worstSeg.openAmount) },
        filters: { segment: worstSeg.name, windowDays: lowActivityWindowDays },
      });
    }

    if (negotiationStaleCount > 0) {
      recs.push({
        id: "rec_negotiation_stale",
        title: `Push stalled Negotiation deals`,
        message: `${negotiationStaleCount} deals in Negotiation have no activity in the last ${staleNoActivityDays} days.`,
        why: "Negotiation is late-stage; quick follow-ups can unblock procurement/legal and pull revenue forward.",
        impact: "medium",
        metricHint: { key: "negotiationStaleAmount", value: round2(negotiationStaleAmount) },
        filters: { stage: "Negotiation", noActivityDays: staleNoActivityDays },
      });
    }

    // Fallback if fewer than 3 recommendations were triggered
    if (recs.length < 3) {
      recs.push({
        id: "rec_general_activity",
        title: "Increase touches on open pipeline this week",
        message: `Prioritize accounts with open deals but ≤${lowActivityMaxCount} activities in the last ${lowActivityWindowDays} days.`,
        why: "Consistent weekly activity is the simplest leading indicator to improve pipeline movement.",
        impact: "low",
        filters: { lowActivityMaxCount, windowDays: lowActivityWindowDays },
      });
    }

    // Keep 3–5 only
    const recommendations = recs.slice(0, 5);

    return res.json({
      status: "ok",
      recommendations: {
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
          analysisNow: now.toISOString().slice(0, 10),
        },
        items: recommendations,
      },
    });
  } catch (err) {
    return next(err);
  }
};
