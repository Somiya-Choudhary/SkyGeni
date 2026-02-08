import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent, Typography } from "@mui/material";

type PieItem = { rep: string; value: number };

type ApiResponse = {
  status: "ok" | "error";
  pie: {
    items: PieItem[];
    meta?: { topN: number; totalClosedWon: number };
  };
};

export default function RepClosedWonPie() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [pieData, setPieData] = useState<PieItem[]>([]);

  const baseUrl = "http://localhost:5000";

  useEffect(() => {
    (async () => {
      const res = await fetch(`${baseUrl}/api/charts/closed-won-by-rep?top=8`);
      if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as ApiResponse;
      setPieData(data?.pie?.items ?? []);
    })().catch(console.error);
  }, []);

  useEffect(() => {
    if (!svgRef.current || pieData.length === 0) return;

    const width = 520;
    const height = 260;
    const radius = 90;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${160},${height / 2})`);

    const pie = d3.pie<PieItem>().value((d) => d.value);

    const arc = d3
      .arc<d3.PieArcDatum<PieItem>>()
      .innerRadius(0)
      .outerRadius(radius);

    const color = d3
      .scaleOrdinal<string>()
      .domain(pieData.map((d) => d.rep))
      .range(d3.schemeTableau10);

    g.selectAll("path")
      .data(pie(pieData))
      .enter()
      .append("path")
      .attr("d", arc as any)
      .attr("fill", (d) => color(d.data.rep));

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${320},${25})`);

    legend
      .selectAll("g")
      .data(pieData)
      .enter()
      .append("g")
      .attr("transform", (_, i) => `translate(0,${i * 22})`)
      .each(function (d) {
        const row = d3.select(this);
        row
          .append("rect")
          .attr("width", 10)
          .attr("height", 10)
          .attr("rx", 2)
          .attr("fill", color(d.rep));

        row
          .append("text")
          .attr("x", 14)
          .attr("y", 10)
          .attr("font-size", 12)
          .text(`${d.rep} (${d.value})`);
      });
  }, [pieData]);

  return (
    <Card sx={{ width: "100%" }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Closed Won by Rep (deduped)
        </Typography>
        <svg ref={svgRef} />
      </CardContent>
    </Card>
  );
}
