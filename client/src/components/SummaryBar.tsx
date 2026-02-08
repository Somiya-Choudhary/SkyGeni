import React, { useEffect, useState } from "react";

type Props = {
  currency?: string;
};

type SummaryApiResponse = {
  status: "ok" | "error";
  summary: {
    currentQuarter: string;
    revenue: number;
    target: number;
    gap: number;
    gapPct: number | null;
    change?: {
      type: "QoQ" | "YoY";
      prevQuarterRevenue: number;
      changePct: number | null;
    };
  };
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

const SummaryBar: React.FC<Props> = ({ currency = "USD" }) => {
  const [qtdRevenue, setQtdRevenue] = useState<number>(0);
  const [target, setTarget] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = "http://localhost:5000";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${baseUrl}/api/summary`);
        if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);

        const data = (await res.json()) as SummaryApiResponse;

        if (!cancelled) {
          setQtdRevenue(data?.summary?.revenue ?? 0);
          setTarget(data?.summary?.target ?? 0);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load summary");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const gapPercent = target === 0 ? 0 : ((qtdRevenue - target) / target) * 100;
  const isBehind = gapPercent < 0;

  const revenueText = formatCurrency(qtdRevenue, currency);
  const targetText = formatCurrency(target, currency);
  const gapText = `${isBehind ? "" : "+"}${formatPercent(gapPercent)} to Goal`;

  return (
    <div
      style={{
        width: "100%",
        padding: "10px 14px",
        boxSizing: "border-box",
        background: "linear-gradient(135deg, #163a63, #2b63a7)",
        border: "1px solid rgba(255,255,255,0.25)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.15) inset",
        color: "#fff",
        marginTop: "2%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
          lineHeight: 1,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 22 }}>
          QTD Revenue: <span style={{ fontWeight: 800 }}>{revenueText}</span>
        </span>

        <span
          style={{
            width: 1,
            height: 22,
            background: "rgba(255,255,255,0.35)",
            display: "inline-block",
          }}
        />

        <span style={{ fontWeight: 600, fontSize: 18, opacity: 0.95 }}>
          Target: <span style={{ fontWeight: 800 }}>{targetText}</span>
        </span>

        <span
          style={{
            width: 1,
            height: 22,
            background: "rgba(255,255,255,0.35)",
            display: "inline-block",
          }}
        />

        <span
          style={{
            fontWeight: 700,
            fontSize: 16,
            color: isBehind ? "#ffb3b3" : "#b9ffcc",
          }}
        >
          {loading ? "Loading…" : error ? "Summary unavailable" : gapText}
        </span>
      </div>

      {error ? (
        <div style={{ marginTop: 6, textAlign: "center", opacity: 0.9, fontSize: 12 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
};

export default SummaryBar;
