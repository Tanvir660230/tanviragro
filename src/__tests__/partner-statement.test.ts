import { PartnerStatementGenerator } from "@/lib/partners/statement-generator";
import type { Partner, PartnerTransaction } from "@/types/database";

describe("Partner Investor Statement Generator", () => {
  const mockPartner: Partner = {
    id: "p-100",
    business_id: "biz-1",
    name: "Rahim Capital",
    partner_type: "capital",
    share_mode: "manual",
    profit_share_pct: 25.0,
    investment_amount: 500000,
    labor_value_monthly: null,
    cliff_months: 0,
    entry_netpl: 0,
    entry_unit_price: null,
    entry_valuation: null,
    bears_loss: true,
    notes: null,
    deleted_at: null,
    joined_at: "2026-01-01",
    created_at: "2026-01-01T00:00:00Z",
  };

  const mockTxns: PartnerTransaction[] = [
    {
      id: "txn-1",
      partner_id: "p-100",
      type: "investment",
      amount: 500000,
      recorded_at: "2026-01-01",
      notes: "Initial Equity Capital",
      deleted_at: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "txn-2",
      partner_id: "p-100",
      type: "profit",
      amount: 50000,
      recorded_at: "2026-06-30",
      notes: "Mid-year Profit Distribution",
      deleted_at: null,
      created_at: "2026-06-30T00:00:00Z",
    },
  ];

  it("generates a complete periodic statement with deterministic audit hash", () => {
    const statement = PartnerStatementGenerator.generateStatement({
      partner: mockPartner,
      allPartners: [mockPartner],
      txns: mockTxns,
      period: {
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      },
      netPLAfterFeePeriod: 200000,
      totalUnrealizedValuationGain: 100000,
      businessId: "biz-1",
    });

    expect(statement.statementId).toContain("STMT-P-100");
    expect(statement.partnerName).toBe("Rahim Capital");
    expect(statement.capitalContributed).toBe(500000);
    expect(statement.profitAllocated).toBe(50000);
    expect(statement.auditHash).toHaveLength(64); // SHA-256 hex
    expect(statement.unrealizedValuationShare).toBe(25000); // 25% of 100,000
    expect(statement.closingMarketEquity).toBe(statement.closingBookEquity + 25000);
  });
});

