// Deal shape from deals.json :contentReference[oaicite:2]{index=2}

export type DealStage =
  | "Prospecting"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost"
  | string;

export interface Deal {
  deal_id: string;
  account_id: string;
  rep_id: string;
  stage: DealStage;
  amount: number | null;
  created_at: string; // e.g. "2025-04-08"
  closed_at: string | null; // can be null
}
