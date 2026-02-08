// Account shape from accounts.json :contentReference[oaicite:0]{index=0}

export type AccountSegment = "SMB" | "Mid-Market" | "Enterprise" | string;
export type AccountIndustry =
  | "SaaS"
  | "Ecommerce"
  | "FinTech"
  | "EdTech"
  | "Healthcare"
  | string;

export interface Account {
  account_id: string;
  name: string;
  industry: AccountIndustry;
  segment: AccountSegment;
}
