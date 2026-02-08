import React, { useEffect, useMemo, useState } from "react";
import { Box, Card, CardContent, Divider, Typography } from "@mui/material";

type StaleDeal = {
  dealId: string;
  accountName: string | null;
  repName: string | null;
  stage: string;
  daysOpen: number;
  daysSinceLastActivity: number | null;
};

type UnderperformingRep = {
  repName: string | null;
  winRatePct: number | null;
  pipelineOpenAmount: number;
};

type LowActivityAccount = {
  accountName: string | null;
  segment: string | null;
  activitiesLastNDays: number;
  openDealsCount: number;
};

type RiskFactorsResponse = {
  status: "ok" | "error";
  riskFactors: {
    parameters: {
      staleMinAgeDays: number;
      staleNoActivityDays: number;
      lowActivityWindowDays: number;
      lowActivityMaxCount: number;
    };
    staleDeals: { count: number; top: StaleDeal[] };
    underperformingReps: { count: number; top: UnderperformingRep[] };
    lowActivityAccounts: { count: number; top: LowActivityAccount[] };
  };
};

type RiskItem = {
  id: string;
  text: string;
};

const Bullet: React.FC = () => (
  <Box
    sx={{
      width: 8,
      height: 8,
      borderRadius: "50%",
      bgcolor: "#f59e0b",
      mt: "6px",
      flex: "0 0 auto",
    }}
  />
);

export default function TopRiskFactorsCard() {
  const [data, setData] = useState<RiskFactorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = "http://localhost:5000";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${baseUrl}/api/risk-factors`);
        if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);

        const json = (await res.json()) as RiskFactorsResponse;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load risk factors");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const items: RiskItem[] = useMemo(() => {
    const rf = data?.riskFactors;
    if (!rf) return [];

    const p = rf.parameters;
    const out: RiskItem[] = [];

    // 1) Stale deals summary
    out.push({
      id: "stale_deals",
      text: `${rf.staleDeals.count} deals are stale (>${p.staleMinAgeDays} days old, no activity in last ${p.staleNoActivityDays} days).`,
    });

    // 2) Worst rep summary (if exists)
    const worstRep = rf.underperformingReps.top?.[0];
    if (worstRep) {
      const wr = worstRep.winRatePct === null ? "N/A" : `${worstRep.winRatePct}%`;
      out.push({
        id: "underperforming_rep",
        text: `Underperforming rep: ${worstRep.repName ?? "Unknown"} – Win Rate: ${wr} (open pipeline ₹${worstRep.pipelineOpenAmount}).`,
      });
    }

    // 3) Low-activity accounts summary
    out.push({
      id: "low_activity_accounts",
      text: `${rf.lowActivityAccounts.count} accounts have low activity (≤${p.lowActivityMaxCount} touches in last ${p.lowActivityWindowDays} days).`,
    });

    // Keep it like your original card (3 bullets)
    return out.slice(0, 3);
  }, [data]);

  return (
    <Card sx={{ width: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Top Risk Factors
          </Typography>

          {loading ? (
            <Typography sx={{ color: "text.secondary", fontWeight: 600 }}>Loading…</Typography>
          ) : error ? (
            <Typography sx={{ color: "error.main", fontWeight: 600 }}>Error</Typography>
          ) : null}
        </Box>

        <Divider />

        <Box sx={{ mt: 1 }}>
          {loading ? (
            <Typography sx={{ color: "text.secondary", mt: 1 }}>Fetching risk factors…</Typography>
          ) : error ? (
            <Typography sx={{ color: "error.main", mt: 1 }}>{error}</Typography>
          ) : items.length === 0 ? (
            <Typography sx={{ color: "text.secondary", mt: 1 }}>No risk factors available.</Typography>
          ) : (
            items.map((it, idx) => (
              <Box
                key={it.id ?? idx}
                sx={{
                  display: "flex",
                  gap: 1.5,
                  py: 1.25,
                  ...(idx !== items.length - 1 ? { borderBottom: "1px solid #eef2f7" } : {}),
                }}
              >
                <Bullet />
                <Typography sx={{ fontWeight: 600, color: "#1f2937" }}>
                  {it.text}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
