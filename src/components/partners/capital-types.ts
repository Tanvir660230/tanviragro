export interface CapitalTxn {
  id: string;
  partner_id: string;
  partner_name: string;
  amount: number;
  type: "investment" | "withdrawal";
  recorded_at: string;
  notes: string | null;
}
