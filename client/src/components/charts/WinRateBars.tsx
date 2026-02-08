import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { fetchSeries, type Point } from "../../api";

function formatMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleString("en-US", { month: "short" });
}

export default function WinRateBars() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [rows, setRows] = useState<Point[]>([]);

  useEffect(() => {
    fetchSeries(`/api/charts/winrate-by-month?months=12`)
      .then(setRows)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!svgRef.current || rows.length === 0) return;

    const width = 520;
    const height = 240;
    const margin = { top: 40, right: 20, bottom: 50, left: 55 };
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
      .text("Win Rate by Month (Closed Won / Closed)");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand<string>()
      .domain(rows.map(r => r.month))
      .range([0, w])
      .padding(0.25);

    const y = d3.scaleLinear().domain([0, 1]).nice().range([h, 0]);

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${Math.round(Number(d) * 100)}%`))
      .selectAll("text")
      .attr("font-size", 12);

    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickFormat(d => formatMonth(String(d))))
      .selectAll("text")
      .attr("font-size", 12);

    g.selectAll("rect")
      .data(rows)
      .enter()
      .append("rect")
      .attr("x", d => x(d.month)!)
      .attr("y", d => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", d => h - y(d.value))
      .attr("rx", 3)
      .attr("fill", "#2563eb");

    g.selectAll("text.value")
      .data(rows)
      .enter()
      .append("text")
      .attr("class", "value")
      .attr("x", d => x(d.month)! + x.bandwidth() / 2)
      .attr("y", d => y(d.value) - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("font-weight", 700)
      .attr("fill", "#111827")
      .text(d => `${Math.round(d.value * 100)}%`);
  }, [rows]);

  return <svg ref={svgRef} />;
}
