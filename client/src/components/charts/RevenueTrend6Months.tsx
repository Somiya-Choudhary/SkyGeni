import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent } from "@mui/material";

type Point = { month: string; value: number };
type SeriesResponse = { status: "ok" | "error"; series: Point[] };

function formatMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleString("en-US", { month: "short" });
}

type Row = { month: string; revenue: number };

export default function RevenueTrend6Months() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const baseUrl = "http://localhost:5000";

  useEffect(() => {
    (async () => {
      const res = await fetch(`${baseUrl}/api/charts/revenue-by-month?months=6`);
      if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);

      const data = (await res.json()) as SeriesResponse;

      const r: Row[] = (data.series ?? [])
        .map((p) => ({ month: p.month, revenue: typeof p.value === "number" ? p.value : 0 }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-6);

      setRows(r);
    })().catch(console.error);
  }, []);

  useEffect(() => {
    if (!svgRef.current || rows.length === 0) return;

    const width = 980;
    const height = 340;
    const margin = { top: 20, right: 30, bottom: 55, left: 60 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    // Title
    svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", 28)
      .attr("font-size", 26)
      .attr("font-weight", 700)
      .text("Revenue Trend (Last 6 Months)");

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top + 30})`);

    // X = months
    const x = d3
      .scaleBand<string>()
      .domain(rows.map((d) => d.month))
      .range([0, w])
      .padding(0.22);

    // Y = revenue
    const maxY = d3.max(rows, (d) => d.revenue) ?? 0;
    const y = d3
      .scaleLinear()
      .domain([0, maxY])
      .nice()
      .range([h, 0]);

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
      .call(d3.axisBottom(x).tickFormat((d) => formatMonth(String(d))))
      .selectAll("text")
      .attr("font-size", 12);

    // Bars
    g.selectAll("rect.bar")
      .data(rows)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.month)!)
      .attr("y", (d) => y(d.revenue))
      .attr("width", x.bandwidth())
      .attr("height", (d) => h - y(d.revenue))
      .attr("rx", 3)
      .attr("fill", "#2563eb");

    // Line
    const lineX = (d: Row) => x(d.month)! + x.bandwidth() / 2;

    const line = d3
      .line<Row>()
      .x((d) => lineX(d))
      .y((d) => y(d.revenue))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(rows)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 3);

    // Dots
    g.selectAll("circle.dot")
      .data(rows)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", (d) => lineX(d))
      .attr("cy", (d) => y(d.revenue))
      .attr("r", 5)
      .attr("fill", "#f59e0b");
  }, [rows]);

  return (
    <Card sx={{ width: "100%" }}>
      <CardContent>
        <svg ref={svgRef} style={{ width: "100%", display: "block" }} />
      </CardContent>
    </Card>
  );
}
