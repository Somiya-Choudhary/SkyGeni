import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent, Typography } from "@mui/material";

type Row = { type: string; count: number };

type ApiResponse = {
  status: "ok" | "error";
  latestActivity: { rows: Row[] };
};

export default function DealsByLatestActivityType() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const baseUrl = "http://localhost:5000";

  useEffect(() => {
    (async () => {
      const res = await fetch(`${baseUrl}/api/charts/open-deals-latest-activity`);
      if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as ApiResponse;
      setRows(data?.latestActivity?.rows ?? []);
    })().catch(console.error);
  }, []);

  useEffect(() => {
    if (!svgRef.current || rows.length === 0) return;

    const width = 520;
    const height = 260;
    const margin = { top: 10, right: 20, bottom: 40, left: 60 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand<string>().domain(rows.map((d) => d.type)).range([0, w]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.count) ?? 0]).nice().range([h, 0]);

    g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x));
    g.append("g").call(d3.axisLeft(y).ticks(5));

    g.selectAll("rect")
      .data(rows)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.type)!)
      .attr("y", (d) => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", (d) => h - y(d.count))
      .attr("rx", 3)
      .attr("fill", "#2563eb");

    g.selectAll("text.val")
      .data(rows)
      .enter()
      .append("text")
      .attr("x", (d) => x(d.type)! + x.bandwidth() / 2)
      .attr("y", (d) => y(d.count) - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 700)
      .text((d) => String(d.count));
  }, [rows]);

  return (
    <Card sx={{ width: "100%" }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Open Deals by Latest Activity Type (Call/Email/Demo)
        </Typography>
        <svg ref={svgRef} />
      </CardContent>
    </Card>
  );
}
