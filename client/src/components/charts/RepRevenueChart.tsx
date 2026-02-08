import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent, Typography } from "@mui/material";

type Row = { rep: string; amount: number };

type ApiResponse = {
  status: "ok" | "error";
  repRevenue: { rows: Row[] };
};

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function RepRevenueChart() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const baseUrl = "http://localhost:5000";

  useEffect(() => {
    (async () => {
      const res = await fetch(`${baseUrl}/api/charts/closed-won-revenue-by-rep?limit=12`);
      if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as ApiResponse;
      setRows(data?.repRevenue?.rows ?? []);
    })().catch(console.error);
  }, []);

  useEffect(() => {
    if (!svgRef.current || rows.length === 0) return;

    const width = 760;
    const height = 320;
    const margin = { top: 10, right: 40, bottom: 45, left: 160 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand<string>().domain(rows.map((d) => d.rep)).range([0, h]).padding(0.2);
    const x = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.amount) ?? 0]).nice().range([0, w]);

    g.append("g").call(d3.axisLeft(y));
    g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(6));

    g.selectAll("rect")
      .data(rows)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d) => y(d.rep)!)
      .attr("width", (d) => x(d.amount))
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", "#2563eb");

    g.selectAll("text.val")
      .data(rows)
      .enter()
      .append("text")
      .attr("x", (d) => x(d.amount) + 6)
      .attr("y", (d) => y(d.rep)! + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 700)
      .text((d) => formatMoney(d.amount));
  }, [rows]);

  return (
    <Card sx={{ width: "100%" }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Revenue Brought by Rep (Closed Won $)
        </Typography>
        <svg ref={svgRef} />
      </CardContent>
    </Card>
  );
}
