// Activity shape from activities.json :contentReference[oaicite:1]{index=1}

export type ActivityType = "call" | "email" | "demo" | string;

// Keeping timestamp as string because JSON has "YYYY-MM-DD"
export interface Activity {
  activity_id: string;
  deal_id: string;
  type: ActivityType;
  timestamp: string; // e.g. "2025-11-11"
}
