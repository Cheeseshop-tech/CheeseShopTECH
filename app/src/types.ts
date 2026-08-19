export type Role = "teen" | "parent";
export type Bucket = "need" | "want" | "goal";
export type Kind = "deposit" | "allocate" | "direct" | "pledged";

export type Item = {
  id: string;
  bucket: Bucket;
  name: string;
  price_cents: number | null;
  currency: string;
  image_url: string | null;
  source_url: string | null;
  source_site: string | null;
  notes: string | null;
  priority: number;
  sort_order: number;
  entry_method: "auto" | "manual" | "screenshot";
  status: "open" | "approved" | "declined" | "purchased" | "archived";
  created_at: string;
};

export type Entry = {
  id: string;
  item_id: string | null;
  link_id: string | null;
  source: "teen" | "parent";
  kind: Kind;
  amount_cents: number;
  fulfilled_at: string | null;
  note: string | null;
  created_at: string;
};

export type State = {
  me: { name: string; role: Role };
  pot: number;
  balance: number;
  pledged: number;
  items: Item[];
  ledger: Entry[];
  people: Record<string, string>;
};

export type Candidate = {
  name: string | null;
  price_cents: number | null;
  currency: string;
  image_url: string | null;
  source_site: string | null;
  source_url: string;
  confidence: number;
};
