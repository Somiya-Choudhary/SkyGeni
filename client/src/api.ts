export const API_BASE = "http://localhost:5000";

export type Point = { month: string; value: number };
export type SeriesResponse = { status: "ok" | "error"; series: Point[] };

export async function fetchSeries(path: string): Promise<Point[]> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Failed ${path}: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as SeriesResponse;
  return data.series ?? [];
}
