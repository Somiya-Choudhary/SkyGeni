import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Box, Card, CardContent, MenuItem, Select, Typography } from "@mui/material";

type ApiResponse = {
  status: "ok" | "error";
  segmentStageIndustry: {
    segment: string;
    segments: string[];
    stages: string[];
    industries: string[];
    series: Array<{ stage: string; values: Array<{ industry: string; count: number }> }>;
  };
};

export default function SegmentStageIndustryChart() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [payload, setPayload] = useState<ApiResponse["segmentStageIndustry"] | null>(null);
  const [segment, setSegment] = useState<string>("");

  const baseUrl = "http://localhost:5000";

  // fetch once to get segments + default payload
  useEffect(() => {
    (async () => {
      const res = await fetch(`${baseUrl}/api/charts/segment-stage-industry?topIndustries=4`);
      if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as ApiResponse;
      setPayload(data.segmentStageIndustry);
      setSegment(data.segmentStageIndustry.segment);
    })().catch(console.error);
  }, []);

  // refetch on segment change
  useEffect(() => {
    if (!segment) return;
    (async () => {
      const res = await fetch(
        `${baseUrl}/api/charts/segment-stage-industry?segment=${encodeURIComponent(segment)}&topIndustries=4`
      );
      if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as ApiResponse;
      setPayload(data.segmentStageIndustry);
    })().catch(console.error);
  }, [segment]);

  useEffect(() => {
    if (!svgRef.current || !payload) return;

    const { stages, industries, series } = payload;

    const width = 820;
    const height = 320;
    const margin = { top: 10, right: 20, bottom: 50, left: 45 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x0 = d3.scaleBand<string>().domain(stages).range([0, w]).padding(0.2);
    const x1 = d3.scaleBand<string>().domain(industries).range([0, x0.bandwidth()]).padding(0.1);

    const maxY =
      d3.max(series, (s) => d3.max(s.values, (v) => v.count) ?? 0) ?? 0;

    const y = d3.scaleLinear().domain([0, maxY]).nice().range([h, 0]);

    g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x0));
    g.append("g").call(d3.axisLeft(y).ticks(5));

    const color = d3.scaleOrdinal<string>().domain(industries).range(d3.schemeTableau10);

    const stageGroups = g
      .selectAll("g.stage")
      .data(series)
      .enter()
      .append("g")
      .attr("class", "stage")
      .attr("transform", (d) => `translate(${x0(d.stage)!},0)`);

    stageGroups
      .selectAll("rect")
      .data((d) => d.values)
      .enter()
      .append("rect")
      .attr("x", (d) => x1(d.industry)!)
      .attr("y", (d) => y(d.count))
      .attr("width", x1.bandwidth())
      .attr("height", (d) => h - y(d.count))
      .attr("rx", 2)
      .attr("fill", (d) => color(d.industry));

    // legend
    const legend = svg.append("g").attr("transform", `translate(${margin.left + 10},${height - 8})`);
    industries.forEach((ind, i) => {
      const x = i * 180;
      const row = legend.append("g").attr("transform", `translate(${x},0)`);
      row.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("y", -10).attr("fill", color(ind));
      row.append("text").attr("x", 14).attr("y", -1).attr("font-size", 12).text(ind);
    });
  }, [payload]);

  const segments = useMemo(() => payload?.segments ?? [], [payload]);

  return (
    <Card sx={{ width: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Segment × Stage × Industry
          </Typography>

          <Select size="small" value={segment} onChange={(e) => setSegment(String(e.target.value))}>
            {segments.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </Box>

        <svg ref={svgRef} />
      </CardContent>
    </Card>
  );
}
