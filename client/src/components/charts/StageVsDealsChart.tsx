import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent, Typography } from "@mui/material";

type StageRow = { stage: string; count: number };

type ApiResponse = {
  status: "ok" | "error";
  stageCounts: {
    chartData: StageRow[];
    totalUniqueDeals: number;
    total: number;
  };
};

export default function StageVsDealsChart() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [chartData, setChartData] = useState<StageRow[]>([]);
  const [totalUniqueDeals, setTotalUniqueDeals] = useState<number>(0);

  const baseUrl = "http://localhost:5000";

  useEffect(() => {
    (async () => {
      const res = await fetch(`${baseUrl}/api/charts/deals-by-stage`);
      if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as ApiResponse;

      setChartData(data?.stageCounts?.chartData ?? []);
      setTotalUniqueDeals(data?.stageCounts?.totalUniqueDeals ?? 0);
    })().catch(console.error);
  }, []);

  useEffect(() => {
    if (!svgRef.current || chartData.length === 0) return;

    const width = 520;
    const height = 300;
    const margin = { top: 10, right: 20, bottom: 60, left: 55 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X = stages
    const x = d3
      .scaleBand<string>()
      .domain(chartData.map((d) => d.stage))
      .range([0, w])
      .padding(0.25);

    // Y = counts
    const yMax = d3.max(chartData, (d) => d.count) ?? 0;
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([h, 0]);

    // Grid
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(() => ""))
      .selectAll("line")
      .attr("stroke", "#e5e7eb");

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .attr("font-size", 12);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("font-size", 12)
      .attr("transform", "rotate(-25)")
      .style("text-anchor", "end");

    // Bars
    g.selectAll("rect.bar")
      .data(chartData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.stage)!)
      .attr("y", (d) => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", (d) => h - y(d.count))
      .attr("rx", 3)
      .attr("fill", "#2563eb");

    // Values
    g.selectAll("text.value")
      .data(chartData)
      .enter()
      .append("text")
      .attr("class", "value")
      .attr("x", (d) => x(d.stage)! + x.bandwidth() / 2)
      .attr("y", (d) => y(d.count) - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 700)
      .attr("fill", "#111827")
      .text((d) => d.count.toString());
  }, [chartData]);

  const total = useMemo(() => chartData.reduce((sum, d) => sum + d.count, 0), [chartData]);

  return (
    <Card sx={{ width: "100%" }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Deals by Stage (Count) — mutually exclusive
        </Typography>

        <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
          Each deal_id is counted only once in its highest stage:
          Closed Won/Lost overrides Negotiation/Prospecting, and Negotiation overrides Prospecting.
        </Typography>

        <svg ref={svgRef} />

        <div style={{ marginTop: 16 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Stage Counts (mutually exclusive)
          </Typography>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, maxWidth: 260 }}>
            {chartData.map((row) => (
              <div key={row.stage} style={{ display: "contents" }}>
                <div>{row.stage}</div>
                <div style={{ textAlign: "right", fontWeight: 600 }}>{row.count}</div>
              </div>
            ))}

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 8, fontWeight: 800 }}>
              Total
            </div>
            <div
              style={{
                borderTop: "1px solid #e5e7eb",
                paddingTop: 8,
                textAlign: "right",
                fontWeight: 800,
              }}
            >
              {total} {totalUniqueDeals > 0 && total === totalUniqueDeals ? "✅" : ""}
            </div>
          </div>

          <Typography variant="caption" sx={{ display: "block", mt: 1, color: "text.secondary" }}>
            Unique deal_ids: {totalUniqueDeals}. Sum of bars: {total}.
          </Typography>
        </div>
      </CardContent>
    </Card>
  );
}
