import React, { useEffect, useMemo, useState } from "react";
import { Box, Card, CardContent, Divider, Typography } from "@mui/material";

type RecommendationItem = {
  id: string;
  title: string;
  message: string;
  impact: "high" | "medium" | "low";
  why?: string;
};

type RecommendationsResponse = {
  status: "ok" | "error";
  recommendations: {
    currentQuarter: string;
    period: { start: string; end: string };
    items: RecommendationItem[];
  };
};

const CheckIcon: React.FC = () => (
  <Box
    sx={{
      width: 18,
      height: 18,
      borderRadius: "50%",
      bgcolor: "#f59e0b",
      display: "grid",
      placeItems: "center",
      color: "white",
      fontSize: 12,
      fontWeight: 900,
      mt: "3px",
      flex: "0 0 auto",
    }}
  >
    ✓
  </Box>
);

export default function RecommendedActionsCard() {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = "http://localhost:5000"; // backend

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${baseUrl}/api/recommendations`);
        if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);

        const data = (await res.json()) as RecommendationsResponse;

        const nextItems = data?.recommendations?.items ?? [];
        if (!cancelled) setItems(nextItems);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load recommendations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    // pick what you want to show in UI: title only OR title + message
    return items.map((r) => ({
      id: r.id,
      primary: r.title,          // main line
      secondary: r.message,      // smaller line (optional)
      impact: r.impact,
    }));
  }, [items]);

  return (
    <Card sx={{ width: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Recommended Actions
          </Typography>

          {/* optional small state indicator */}
          {loading ? (
            <Typography sx={{ color: "text.secondary", fontWeight: 600 }}>Loading…</Typography>
          ) : error ? (
            <Typography sx={{ color: "error.main", fontWeight: 600 }}>Error</Typography>
          ) : null}
        </Box>

        <Divider />

        <Box sx={{ mt: 1 }}>
          {loading ? (
            <Typography sx={{ color: "text.secondary", mt: 1 }}>Fetching recommendations…</Typography>
          ) : error ? (
            <Typography sx={{ color: "error.main", mt: 1 }}>
              {error}
            </Typography>
          ) : rows.length === 0 ? (
            <Typography sx={{ color: "text.secondary", mt: 1 }}>
              No recommendations available.
            </Typography>
          ) : (
            rows.map((r, idx) => (
              <Box
                key={r.id ?? idx}
                sx={{
                  display: "flex",
                  gap: 1.5,
                  py: 1.25,
                  ...(idx !== rows.length - 1 ? { borderBottom: "1px solid #eef2f7" } : {}),
                }}
              >
                <CheckIcon />

                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, color: "#1f2937" }}>
                    {r.primary}
                  </Typography>

                  {/* optional second line */}
                  <Typography sx={{ color: "text.secondary", mt: 0.25, fontSize: 13 }}>
                    {r.secondary}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
