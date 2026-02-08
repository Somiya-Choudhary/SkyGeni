import accountsRaw from "../../data/accounts.json";
import activitiesRaw from "../../data/activities.json";
import dealsRaw from "../../data/deals.json";
import repsRaw from "../../data/reps.json";
import targetsRaw from "../../data/targets.json";

import type { Account } from "./types/account";
import type { Activity } from "./types/activity";
import type { Deal } from "./types/deal";
import type { Rep } from "./types/rep";
import type { Target } from "./types/target";

const accounts = accountsRaw as Account[];
const activities = activitiesRaw as Activity[];
const deals = dealsRaw as Deal[];
const reps = repsRaw as Rep[];
const targets = targetsRaw as Target[];

/** ---------- Cleaning helpers ---------- */
function toISODateOrNull(s: unknown): string | null {
  if (typeof s !== "string") return null;
  // expect "YYYY-MM-DD"
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : s;
}

function normalizeStage(s: unknown): Deal["stage"] {
  if (typeof s !== "string") return "Unknown";
  const v = s.trim().toLowerCase();

  // map common variants
  if (v === "closed won" || v === "won" || v === "closed-won") return "Closed Won";
  if (v === "closed lost" || v === "lost" || v === "closed-lost") return "Closed Lost";
  if (v === "prospecting" || v === "prospect") return "Prospecting";
  if (v === "negotiation" || v === "negotiating") return "Negotiation";

  // keep original-ish (capitalized) if unknown
  return s as Deal["stage"];
}

function toNumberOrNull(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function dedupeById<T extends Record<string, any>>(arr: T[], idKey: keyof T) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const id = String(item[idKey] ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

/** ---------- Clean data ---------- */
const cleanAccounts = dedupeById(
  accounts
    .filter(a => typeof a.account_id === "string" && typeof a.name === "string")
    .map(a => ({
      ...a,
      industry: typeof a.industry === "string" ? a.industry.trim() : "Unknown",
      segment: typeof a.segment === "string" ? a.segment.trim() : "Unknown",
    })),
  "account_id"
);

const cleanReps = dedupeById(
  reps
    .filter(r => typeof r.rep_id === "string" && typeof r.name === "string")
    .map(r => ({ ...r, name: r.name.trim() })),
  "rep_id"
);

const cleanTargets = dedupeById(
  targets
    .filter(t => typeof t.month === "string" && toNumberOrNull((t as any).target) !== null)
    .map(t => ({ month: t.month, target: Number((t as any).target) })),
  "month"
);

const accountsById = new Map(cleanAccounts.map(a => [a.account_id, a]));
const repsById = new Map(cleanReps.map(r => [r.rep_id, r]));
const targetsByMonth = new Map(cleanTargets.map(t => [t.month, t.target]));

/**
 * Deals cleaning rules:
 * - must have deal_id, account_id, rep_id
 * - stage normalized
 * - amount: number or null; negative -> null
 * - created_at valid date string
 * - closed_at valid date string or null
 * - if closed_at exists but earlier than created_at -> drop closed_at (set null)
 * - optional: drop deals whose account_id/rep_id not found
 */
const cleanDeals = dedupeById(
  deals
    .filter(d => typeof d.deal_id === "string" && typeof d.account_id === "string" && typeof d.rep_id === "string")
    .map(d => {
      const created_at = toISODateOrNull(d.created_at) ?? null;
      const closed_at = toISODateOrNull(d.closed_at);

      let amount = toNumberOrNull(d.amount);
      if (amount !== null && amount < 0) amount = null;

      const stage = normalizeStage(d.stage);

      // fix bad dates
      let finalClosed = closed_at;
      if (created_at && closed_at) {
        const c1 = new Date(`${created_at}T00:00:00.000Z`).getTime();
        const c2 = new Date(`${closed_at}T00:00:00.000Z`).getTime();
        if (c2 < c1) finalClosed = null; // inconsistent; don't trust
      }

      return {
        ...d,
        stage,
        amount,
        created_at: created_at ?? "1970-01-01", // fallback (or you can filter these out)
        closed_at: finalClosed,
      };
    })
    // optional strict referential integrity:
    .filter(d => accountsById.has(d.account_id) && repsById.has(d.rep_id)),
  "deal_id"
);

/**
 * Activities cleaning rules:
 * - must have activity_id + deal_id
 * - timestamp valid date
 * - optional: drop activities where deal_id not found
 */
const dealsById = new Map(cleanDeals.map(d => [d.deal_id, d]));

const cleanActivities = dedupeById(
  activities
    .filter(a => typeof a.activity_id === "string" && typeof a.deal_id === "string")
    .map(a => ({
      ...a,
      type: typeof a.type === "string" ? a.type.trim().toLowerCase() : "unknown",
      timestamp: toISODateOrNull(a.timestamp) ?? "1970-01-01",
    }))
    .filter(a => dealsById.has(a.deal_id)), // keep only valid deal refs
  "activity_id"
);

// activities index
const activitiesByDealId = new Map<string, Activity[]>();
for (const act of cleanActivities) {
  const list = activitiesByDealId.get(act.deal_id) ?? [];
  list.push(act);
  activitiesByDealId.set(act.deal_id, list);
}

// export both raw + cleaned if you want
export const store = {
  accounts,
  activities,
  deals,
  reps,
  targets,
};

export const cleanStore = {
  accounts: cleanAccounts,
  reps: cleanReps,
  targets: cleanTargets,
  deals: cleanDeals,
  activities: cleanActivities,

  accountsById,
  repsById,
  dealsById,
  targetsByMonth,
  activitiesByDealId,
};
