import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent, Typography } from "@mui/material";

type HeatCell = { rep: string; stage: string; count: number };
type ApiResponse = {
  status: "ok" | "error";
  heatmap: { reps: string[]; stages: string[]; cells: HeatCell[] };
};

export default function StageVsRepHeatmap() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [payload, setPayload] = useState<ApiResponse["heatmap"] | null>(null);
  const baseUrl = "http://localhost:5000";

  useEffect(() => {
    (async () => {
      const res = await fetch(`${baseUrl}/api/charts/stage-by-rep-heatmap`);
      if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as ApiResponse;
      setPayload(data.heatmap);
    })().catch(console.error);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !payload) return;

    const { reps, stages, cells } = payload;

    const width = 860;
    const height = 360;
    const margin = { top: 20, right: 20, bottom: 95, left: 160 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand<string>().domain(stages).range([0, w]).padding(0.08);
    const y = d3.scaleBand<string>().domain(reps).range([0, h]).padding(0.08);

    const max = d3.max(cells, (d) => d.count) ?? 0;

    const color = d3
      .scaleLinear<string>()
      .domain([0, max || 1])
      .range(["#eef2ff", "#1d4ed8"]);

    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end")
      .attr("font-size", 12);

    g.append("g").call(d3.axisLeft(y)).selectAll("text").attr("font-size", 12);

    g.selectAll("rect.cell")
      .data(cells)
      .enter()
      .append("rect")
      .attr("class", "cell")
      .attr("x", (d) => x(d.stage)!)
      .attr("y", (d) => y(d.rep)!)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("rx", 3)
      .attr("fill", (d) => color(d.count));

    g.selectAll("text.cell-value")
      .data(cells)
      .enter()
      .append("text")
      .attr("class", "cell-value")
      .attr("x", (d) => x(d.stage)! + x.bandwidth() / 2)
      .attr("y", (d) => y(d.rep)! + y.bandwidth() / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", 11)
      .attr("font-weight", 700)
      .attr("fill", (d) => (max === 0 ? "#374151" : d.count / max >= 0.45 ? "#ffffff" : "#374151"))
      .text((d) => (d.count > 0 ? String(d.count) : ""));
  }, [payload]);

  return (
    <Card sx={{ width: "100%" }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Stage × Rep (Heatmap)
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
          Counts are based on final stage per deal_id, so deals are not double-counted across stages.
        </Typography>
        <svg ref={svgRef} />
      </CardContent>
    </Card>
  );
}
