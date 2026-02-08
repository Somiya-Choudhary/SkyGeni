import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent } from "@mui/material";
import { fetchSeries, type Point } from "../../api";

function formatMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleString("en-US", { month: "short" });
}

function formatMoneyCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default function PipelineSparkline() {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [points, setPoints] = useState<Point[]>([]);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    fetchSeries(`/api/charts/pipeline-by-month?months=12`)
      .then(setPoints)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const measure = () => {
      const w = cardRef.current?.getBoundingClientRect().width ?? 0;
      setContainerWidth(Math.floor(w));
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    if (cardRef.current) ro.observe(cardRef.current);

    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current || points.length === 0 || containerWidth === 0) return;

    const width = containerWidth;
    const height = 260;
    const margin = { top: 40, right: 20, bottom: 50, left: 70 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", 24)
      .attr("font-size", 16)
      .attr("font-weight", 700)
      .text("Pipeline Value (Open Deals) by Month");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint<string>()
      .domain(points.map(d => d.month))
      .range([0, w])
      .padding(0.5);

    const y = d3.scaleLinear()
      .domain([0, d3.max(points, d => d.value) ?? 0])
      .nice()
      .range([h, 0]);

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => formatMoneyCompact(Number(d))))
      .selectAll("text")
      .attr("font-size", 12);

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(() => ""))
      .selectAll("line")
      .attr("stroke", "#e5e7eb");

    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickFormat(d => formatMonth(String(d))))
      .selectAll("text")
      .attr("font-size", 12);

    const area = d3.area<Point>()
      .x(d => x(d.month)!)
      .y0(h)
      .y1(d => y(d.value))
      .curve(d3.curveMonotoneX);

    const line = d3.line<Point>()
      .x(d => x(d.month)!)
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    g.append("path").datum(points).attr("d", area).attr("fill", "#bfdbfe");
    g.append("path").datum(points).attr("d", line).attr("fill", "none").attr("stroke", "#2563eb").attr("stroke-width", 2);

    g.selectAll("circle.dot")
      .data(points)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.month)!)
      .attr("cy", d => y(d.value))
      .attr("r", 3)
      .attr("fill", "#2563eb");

    g.selectAll("text.val")
      .data(points)
      .enter()
      .append("text")
      .attr("class", "val")
      .attr("x", d => x(d.month)!)
      .attr("y", d => y(d.value) - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("font-weight", 700)
      .attr("fill", "#111827")
      .text(d => formatMoneyCompact(d.value));
  }, [points, containerWidth]);

  return (
    <Card ref={cardRef} sx={{ width: "100%" }}>
      <CardContent>
        <svg ref={svgRef} style={{ display: "block", width: "100%" }} />
      </CardContent>
    </Card>
  );
}
