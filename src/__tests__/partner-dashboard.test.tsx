/** The partners page renders the central figures (no loss before any sale) in Bangla and English. */
import { renderToString } from "react-dom/server";
import { I18nProvider } from "@/i18n/I18nProvider";
import bn from "@/i18n/dictionaries/bn.json";
import en from "@/i18n/dictionaries/en.json";
import { buildPartnerPositions } from "@/lib/partners/position";
import type { Partner } from "@/types/database";

jest.mock("@/app/dashboard/(app)/partners/actions", () => ({
  createPartner: jest.fn(), addPartnerTransaction: jest.fn(), declareDistribution: jest.fn(), deletePartner: jest.fn(), deletePartnerTransaction: jest.fn(),
  saveShareRule: jest.fn(), deleteShareRule: jest.fn(), retirePartner: jest.fn(),
  previewCycleClose: jest.fn(), closeCycle: jest.fn(), reopenLastCycle: jest.fn(),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }));

import { PartnerDashboard } from "@/components/partners/PartnerDashboard";

const partnerRow = (id: string, name: string, over: Partial<Partner> = {}) => ({
  id, business_id: "b", name, partner_type: "capital", share_mode: "auto", profit_share_pct: 0, bears_loss: true,
  joined_at: "2026-06-01", cliff_months: 0, labor_value_monthly: null, investment_amount: 0, notes: null, ...over,
}) as unknown as Partner;

const rows = [partnerRow("t", "Tanvir Khan"), partnerRow("m", "Md Mohiuddin", { partner_type: "labor", share_mode: "manual", profit_share_pct: 50, bears_loss: false }), partnerRow("n", "Nanu", { joined_at: "2026-06-08" })];
const { farm, partners: positions } = buildPartnerPositions({
  asOf: "2026-09-26", rules: [], feeRates: [], marketPricePerKg: 420,
  dailyCosts: [{ date: "2026-08-01", amount: 154120 }],
  partners: rows.map((p) => ({ id: p.id, name: p.name, partnerType: p.partner_type, joinedAt: p.joined_at, leftAt: null, laborValueMonthly: null, cliffMonths: 0,
    shareMode: p.share_mode as "auto" | "manual", fixedPct: Number(p.profit_share_pct), bearsLoss: p.bears_loss })),
  txns: [{ partnerId: "t", type: "investment", amount: 494838, date: "2026-06-01" }, { partnerId: "n", type: "investment", amount: 160000, date: "2026-06-08" }],
  animals: [{ id: "a", tag: "C001", status: "active", purchaseDate: "2026-06-01", endDate: null, purchasePrice: 76000, ownCost: 2000, salePrice: null, valueToday: 136980 }],
});

function render(locale: "bn" | "en") {
  return renderToString(
    <I18nProvider dictionary={(locale === "bn" ? bn : en) as never} locale={locale}>
      <PartnerDashboard farm={farm} positions={positions} partners={rows} cash={16782} cyclesEnabled cycleNotes={{}} canManage />
    </I18nProvider>,
  );
}

test("renders the farm position and every partner, without a loss before any sale", () => {
  const html = render("bn");
  expect(html).toContain("এখনো কোনো গরু বিক্রি হয়নি");
  expect(html).toContain("Tanvir Khan");
  expect(html).toContain("Md Mohiuddin");
  expect(html).toContain("টাকা × দিন");
  expect(html).toContain("হিসাবের চক্র");
  expect(html).not.toContain("ক্ষতি বাকি");
  expect(render("en")).toContain("No animal has been sold yet");
});

import { PartnerProfileClient } from "@/components/partners/PartnerProfileClient";

test("the profile shows the same position (capital, share, estimate, account value)", () => {
  const tanvir = positions.find((p) => p.id === "t")!;
  const pp = rows.map((p) => ({ id: p.id, name: p.name, partnerType: p.partner_type, joinedAt: p.joined_at, leftAt: null, laborValueMonthly: null, cliffMonths: 0,
    shareMode: p.share_mode as "auto" | "manual", fixedPct: Number(p.profit_share_pct), bearsLoss: p.bears_loss }));
  const html = renderToString(
    <I18nProvider dictionary={bn as never} locale="bn">
      <PartnerProfileClient partner={rows[0]} transactions={[]} position={tanvir}
        farm={{ realized: farm.realized, estimate: farm.estimate, total: farm.total, soldCount: 0, marketPricePerKg: 420, herdValued: true }}
        money={{ cash: 16782, moneyTypesEnabled: true }}
        shareRules={{ partner: pp[0], partners: pp, rules: [{ id: "r1", partnerId: "t", from: "2026-06-01", shareMode: "auto", fixedPct: 0, bearsLoss: true, note: null }],
          lockedUntil: null, rulesEnabled: true, canManage: true }} />
    </I18nProvider>,
  );
  expect(html).toContain("মোট পাওনা");
  expect(html).toContain("ভাগের নিয়ম");
  expect(html).toContain("ভাগ বদলান");
  expect(html).toContain(Math.round(tanvir.balance).toLocaleString("en-IN"));
});
