import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
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

export default function AvgDealSparkline() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [data, setData] = useState<Point[]>([]);

  useEffect(() => {
    fetchSeries(`/api/charts/avgdealsize-by-month?months=12`)
      .then(setData)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const width = 520;
    const height = 220;
    const margin = { top: 40, right: 20, bottom: 50, left: 70 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    svg.append("text")
      .attr("x", margin.left)
      .attr("y", 22)
      .attr("font-size", 16)
      .attr("font-weight", 700)
      .text("Average Deal Size by Month");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint<string>()
      .domain(data.map(d => d.month))
      .range([0, w])
      .padding(0.5);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) ?? 0])
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

    g.append("path").datum(data).attr("d", area).attr("fill", "#bfdbfe");
    g.append("path").datum(data).attr("d", line).attr("fill", "none").attr("stroke", "#2563eb").attr("stroke-width", 2);

    g.selectAll("circle.dot")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", d => x(d.month)!)
      .attr("cy", d => y(d.value))
      .attr("r", 3)
      .attr("fill", "#2563eb");
  }, [data]);

  return <svg ref={svgRef} />;
}
