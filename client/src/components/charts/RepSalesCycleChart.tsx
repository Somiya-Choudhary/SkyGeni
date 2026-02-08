import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent, Typography } from "@mui/material";

type Row = { rep: string; avgDays: number; deals: number };

type ApiResponse = {
  status: "ok" | "error";
  salesCycleByRep: { rows: Row[] };
};

export default function RepSalesCycleChart() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const baseUrl = "http://localhost:5000";

  useEffect(() => {
    (async () => {
      const res = await fetch(`${baseUrl}/api/charts/sales-cycle-by-rep?minDeals=3&limit=12`);
      if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as ApiResponse;
      setRows(data?.salesCycleByRep?.rows ?? []);
    })().catch(console.error);
  }, []);

  useEffect(() => {
    if (!svgRef.current || rows.length === 0) return;

    const width = 720;
    const height = 320;
    const margin = { top: 10, right: 20, bottom: 45, left: 140 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand<string>().domain(rows.map((d) => d.rep)).range([0, h]).padding(0.2);
    const x = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.avgDays) ?? 0]).nice().range([0, w]);

    g.append("g").call(d3.axisLeft(y));
    g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(6));

    g.selectAll("rect")
      .data(rows)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d) => y(d.rep)!)
      .attr("width", (d) => x(d.avgDays))
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", "#0ea5e9");

    g.selectAll("text.val")
      .data(rows)
      .enter()
      .append("text")
      .attr("x", (d) => x(d.avgDays) + 6)
      .attr("y", (d) => y(d.rep)! + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .attr("font-size", 12)
      .text((d) => `${Math.round(d.avgDays)}d (${d.deals})`);
  }, [rows]);

  return (
    <Card sx={{ width: "100%" }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Avg Sales Cycle by Rep (days)
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
          Cleaned: final deal row, Closed Won/Lost, valid dates, reps with ≥ 3 closed deals.
        </Typography>
        <svg ref={svgRef} />
      </CardContent>
    </Card>
  );
}
