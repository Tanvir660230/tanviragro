import { PartnerEngine } from "@/lib/partners/partner-engine";
import type { Partner, PartnerTransaction } from "@/types/database";

describe("Phase 6: Enterprise Partner, Investment & Equity Engine", () => {
  const dummyPartners: Partner[] = [
    {
      id: "p1",
      business_id: "biz-1",
      name: "Tanvir Ahmed",
      partner_type: "capital",
      investment_amount: 500000,
      profit_share_pct: 0,
      share_mode: "auto",
      joined_at: "2025-01-01",
      bears_loss: true,
      cliff_months: 0,
      labor_value_monthly: null,
      notes: null,
      entry_netpl: 0,
      entry_valuation: null,
      entry_unit_price: 100,
      created_at: "2025-01-01T00:00:00Z",
      deleted_at: null,
    },
    {
      id: "p2",
      business_id: "biz-1",
      name: "Rahim Chowdhury",
      partner_type: "capital",
      investment_amount: 300000,
      profit_share_pct: 0,
      share_mode: "auto",
      joined_at: "2025-01-01",
      bears_loss: true,
      cliff_months: 0,
      labor_value_monthly: null,
      notes: null,
      entry_netpl: 0,
      entry_valuation: null,
      entry_unit_price: 100,
      created_at: "2025-01-01T00:00:00Z",
      deleted_at: null,
    },
    {
      id: "p3",
      business_id: "biz-1",
      name: "Karim Uddin",
      partner_type: "labor",
      investment_amount: 0,
      profit_share_pct: 20,
      share_mode: "manual",
      joined_at: "2025-01-01",
      bears_loss: false,
      cliff_months: 0,
      labor_value_monthly: 10000,
      notes: null,
      entry_netpl: 0,
      entry_valuation: null,
      entry_unit_price: null,
      created_at: "2025-01-01T00:00:00Z",
      deleted_at: null,
    },
  ];

  const dummyTxns: PartnerTransaction[] = [
    {
      id: "tx-1",
      partner_id: "p1",
      amount: 500000,
      type: "investment",
      recorded_at: "2025-01-01",
      notes: "Initial investment",
      created_at: "2025-01-01T00:00:00Z",
      deleted_at: null,
    },
    {
      id: "tx-2",
      partner_id: "p2",
      amount: 300000,
      type: "investment",
      recorded_at: "2025-01-01",
      notes: "Initial investment",
      created_at: "2025-01-01T00:00:00Z",
      deleted_at: null,
    },
    {
      id: "tx-3",
      partner_id: "p1",
      amount: 50000,
      type: "withdrawal",
      recorded_at: "2025-06-01",
      notes: "Capital draw",
      created_at: "2025-06-01T00:00:00Z",
      deleted_at: null,
    },
    {
      id: "tx-4",
      partner_id: "p1",
      amount: 60000,
      type: "profit",
      recorded_at: "2025-12-31",
      notes: "Profit dividend",
      created_at: "2025-12-31T00:00:00Z",
      deleted_at: null,
    },
  ];

  const txnsByPartner: Record<string, PartnerTransaction[]> = {
    p1: dummyTxns.filter((t) => t.partner_id === "p1"),
    p2: dummyTxns.filter((t) => t.partner_id === "p2"),
    p3: dummyTxns.filter((t) => t.partner_id === "p3"),
  };

  test("calculates comprehensive farm-wide equity summary with zero variance", () => {
    const netPL = 200000;
    const summary = PartnerEngine.calculateFarmEquitySummary({
      partners: dummyPartners,
      txnsByPartner,
      netPL,
      mgmtFeeRate: 10,
    });

    expect(summary.totalPartners).toBe(3);
    expect(summary.totalContributedCapital).toBe(800000);
    expect(summary.totalWithdrawnCapital).toBe(50000);
    expect(summary.netContributedCapital).toBe(750000);
    expect(summary.totalDistributedProfit).toBe(60000);
    expect(summary.ownershipBalanced).toBe(true);
  });

  test("evaluates settlement eligibility and prevents overdrafting capital or cash", () => {
    const p1Equity = PartnerEngine.calculatePartnerEquity({
      partner: dummyPartners[0],
      allPartners: dummyPartners,
      txnsByPartner,
      netPLAfterFee: 180000,
    });

    const settlement1 = PartnerEngine.evaluateSettlement({
      equity: p1Equity,
      settlementType: "profit_payout",
      requestedAmount: 100000,
      availableCash: 500000,
    });
    expect(settlement1.canExecute).toBe(false);
    expect(settlement1.blockReason).toContain("exceeds pending profit");

    const settlement2 = PartnerEngine.evaluateSettlement({
      equity: p1Equity,
      settlementType: "profit_payout",
      requestedAmount: 20000,
      availableCash: 5000,
    });
    expect(settlement2.canExecute).toBe(false);
    expect(settlement2.blockReason).toContain("Insufficient farm cash");
  });

  test("validates partner transactions rejecting negative amounts and excess drawings", () => {
    const invalidTxn = PartnerEngine.validateTransaction({
      partnerId: "p1",
      type: "investment",
      amount: -5000,
      recordedAt: "2026-01-01",
    });
    expect(invalidTxn.isValid).toBe(false);
    expect(invalidTxn.errors[0]).toContain("positive number");
  });


  test("calculates proportional auto and fixed manual ownership shares accurately", () => {
    const p1Share = PartnerEngine.calculateEffectiveShare(dummyPartners[0], dummyPartners, txnsByPartner);
    const p2Share = PartnerEngine.calculateEffectiveShare(dummyPartners[1], dummyPartners, txnsByPartner);
    const p3Share = PartnerEngine.calculateEffectiveShare(dummyPartners[2], dummyPartners, txnsByPartner);

    expect(p3Share).toBe(20);
    expect(p1Share).toBe(48);
    expect(p2Share).toBe(32);
    expect(p1Share + p2Share + p3Share).toBe(100);
  });
});
