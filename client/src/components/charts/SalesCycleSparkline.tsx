import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { fetchSeries, type Point } from "../../api";

export default function SalesCycleSparkline() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [points, setPoints] = useState<Point[]>([]);

  useEffect(() => {
    fetchSeries(`/api/charts/salescycle-by-month?months=12`)
      .then(setPoints)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!svgRef.current || points.length === 0) return;

    const width = 360;
    const height = 140;
    const margin = { top: 40, right: 16, bottom: 35, left: 45 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const values = points.map(p => p.value);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .attr("font-size", 14)
      .attr("font-weight", 700)
      .text("Average Sales Cycle Trend");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, values.length - 1]).range([0, w]);
    const y = d3.scaleLinear().domain(d3.extent(values) as [number, number]).nice().range([h, 0]);

    svg.append("text")
      .attr("x", margin.left + w / 2)
      .attr("y", height - 5)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#374151")
      .text("Time (Last 12 Months)");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + h / 2))
      .attr("y", 14)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#374151")
      .text("Avg Sales Cycle (Days)");

    const area = d3.area<number>()
      .x((_, i) => x(i))
      .y0(h)
      .y1(d => y(d))
      .curve(d3.curveMonotoneX);

    const line = d3.line<number>()
      .x((_, i) => x(i))
      .y(d => y(d))
      .curve(d3.curveMonotoneX);

    g.append("path").datum(values).attr("d", area).attr("fill", "#f59e0b").attr("opacity", 0.18);
    g.append("path").datum(values).attr("d", line).attr("fill", "none").attr("stroke", "#f59e0b").attr("stroke-width", 2);
  }, [points]);

  return <svg ref={svgRef} />;
}
