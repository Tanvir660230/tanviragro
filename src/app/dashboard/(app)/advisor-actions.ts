"use server";

import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";

export type AdvisorQuestion =
  | "daily_tasks"
  | "feed_status"
  | "sell_ready"
  | "health_status"
  | "monthly_performance";

export type AdvisorItem = {
  label: string;
  value: string;
  status: "ok" | "warning" | "danger" | "info";
  href?: string;
};

export type AdvisorResult =
  | {
      ok: true;
      title: string;
      summary: string;
      items: AdvisorItem[];
      tip: string;
    }
  | { ok: false; error: string };

function bdtFmt(n: number): string {
  return "৳" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export async function askAdvisor(question: AdvisorQuestion): Promise<AdvisorResult> {
  try {
    const supabase = await getServerClient();
    const businessId = await getCachedBusinessId();
    if (!businessId) return { ok: false, error: "ফার্ম পাওয়া যায়নি" };

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const in7Days = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);

    // ── আজকের কাজ ────────────────────────────────────────────────────────────
    if (question === "daily_tasks") {
      const { data: cattleData } = await supabase
        .from("cattle")
        .select("id, tag_id, is_quarantined")
        .eq("business_id", businessId)
        .eq("status", "active")
        .is("deleted_at", null);

      const allActive = (cattleData ?? []) as { id: string; tag_id: string; is_quarantined: boolean }[];
      const activeIds = allActive.map((c) => c.id);

      if (activeIds.length === 0) {
        return {
          ok: true,
          title: "আজকের কাজের তালিকা",
          summary: "এখনো কোনো সক্রিয় গরু নেই।",
          items: [{ label: "গরু যোগ করুন", value: "শুরু করতে Cattle পেজে যান", status: "info", href: "/dashboard/cattle" }],
          tip: "প্রথমে গরু যোগ করুন।",
        };
      }

      const [{ data: recentWeights }, { count: overdueCount }] = await Promise.all([
        supabase
          .from("weight_logs")
          .select("cattle_id")
          .in("cattle_id", activeIds)
          .gte("recorded_at", sevenDaysAgo)
          .is("deleted_at", null),
        supabase
          .from("health_events")
          .select("*", { count: "exact", head: true })
          .eq("business_id", businessId)
          .lt("scheduled_at", todayStr)
          .is("completed_at", null)
          .is("deleted_at", null),
      ]);

      const weighedIds = new Set(
        (recentWeights ?? []).map((w: { cattle_id: string }) => w.cattle_id)
      );
      const unweighedCount = activeIds.filter((id) => !weighedIds.has(id)).length;
      const quarantinedCount = allActive.filter((c) => c.is_quarantined).length;

      const items: AdvisorItem[] = [
        {
          label: "ওজন নেওয়া বাকি (৭+ দিন)",
          value: unweighedCount === 0 ? "✓ সব গরু ওজন দেওয়া হয়েছে" : `${unweighedCount}টি গরু`,
          status: unweighedCount === 0 ? "ok" : unweighedCount > 3 ? "danger" : "warning",
          href: unweighedCount > 0 ? "/dashboard/cattle?open=bulk-weigh" : undefined,
        },
        {
          label: "Overdue স্বাস্থ্য ইভেন্ট",
          value: (overdueCount ?? 0) === 0 ? "✓ কোনো বাকি নেই" : `${overdueCount}টি ইভেন্ট বাকি`,
          status: (overdueCount ?? 0) === 0 ? "ok" : (overdueCount ?? 0) > 5 ? "danger" : "warning",
          href: (overdueCount ?? 0) > 0 ? "/dashboard/cattle/health" : undefined,
        },
      ];

      if (quarantinedCount > 0) {
        items.push({
          label: "কোয়ারেন্টাইনে আছে",
          value: `${quarantinedCount}টি গরু পর্যবেক্ষণে`,
          status: "warning",
          href: "/dashboard/cattle",
        });
      }

      const urgentCount = unweighedCount + (overdueCount ?? 0);
      const allDone = urgentCount === 0 && quarantinedCount === 0;

      return {
        ok: true,
        title: "আজকের কাজের তালিকা",
        summary: allDone
          ? `${activeIds.length}টি সক্রিয় গরু — আজকের সব কাজ শেষ!`
          : `${activeIds.length}টি সক্রিয় গরুর মধ্যে ${urgentCount}টি জরুরি কাজ বাকি।`,
        items,
        tip: allDone ? "দারুণ! ফার্ম ভালোভাবে চলছে।" : "জরুরি কাজগুলো আজকেই সেরে ফেলুন।",
      };
    }

    // ── ফিড স্ট্যাটাস ─────────────────────────────────────────────────────────
    if (question === "feed_status") {
      const [{ data: feedItems }, { data: statsData }, { data: activeRecipeData }] =
        await Promise.all([
          supabase
            .from("inventory_items")
            .select("id, name, category, unit, low_stock_threshold")
            .eq("business_id", businessId)
            .is("deleted_at", null)
            .in("category", ["feed", "roughage"])
            .eq("is_discontinued", false),
          supabase.rpc("get_inventory_stats", {
            p_business_id: businessId,
            p_30_days_ago: thirtyDaysAgo,
          }),
          supabase
            .from("feed_recipes")
            .select("name")
            .eq("business_id", businessId)
            .eq("is_active", true)
            .is("deleted_at", null)
            .maybeSingle(),
        ]);

      type StatRow = { item_id: string; total_stock: number; consumed_last_30d: number };
      const statsMap = new Map(
        ((statsData ?? []) as StatRow[]).map((s) => [s.item_id, s])
      );

      if ((feedItems ?? []).length === 0) {
        return {
          ok: true,
          title: "ফিডের অবস্থা",
          summary: "কোনো ফিড/রাফেজ আইটেম ট্র্যাক করা হচ্ছে না।",
          items: [{ label: "ফিড যোগ করুন", value: "Inventory পেজে যান", status: "info", href: "/dashboard/inventory" }],
          tip: "ইনভেন্টরিতে ফিড আইটেম যোগ করুন।",
        };
      }

      let hasLowStock = false;
      const items: AdvisorItem[] = (feedItems ?? []).map((item: {
        id: string; name: string; category: string; unit: string; low_stock_threshold: number | null
      }) => {
        const stat = statsMap.get(item.id);
        const stock = Math.max(0, stat?.total_stock ?? 0);
        const dailyAvg = (stat?.consumed_last_30d ?? 0) / 30;
        const daysLeft = dailyAvg > 0 ? Math.floor(stock / dailyAvg) : null;

        const status: AdvisorItem["status"] =
          daysLeft === null ? "info" :
          daysLeft <= 0   ? "danger" :
          daysLeft <= 3   ? "danger" :
          daysLeft <= 7   ? "warning" : "ok";

        if (status === "danger" || status === "warning") hasLowStock = true;

        return {
          label: `${item.name}`,
          value:
            daysLeft === null ? `${stock.toFixed(1)} ${item.unit} (ব্যবহার নেই)` :
            daysLeft <= 0    ? `স্টক শেষ!` :
            `${stock.toFixed(1)} ${item.unit} — প্রায় ${daysLeft} দিন`,
          status,
          href: "/dashboard/inventory",
        };
      });

      const recipeName = (activeRecipeData as { name: string } | null)?.name ?? null;

      return {
        ok: true,
        title: "ফিডের অবস্থা",
        summary: hasLowStock
          ? `কিছু ফিড কম হয়ে আসছে${recipeName ? ` (রেসিপি: ${recipeName})` : ""}।`
          : `সব ফিড পর্যাপ্ত আছে${recipeName ? ` (রেসিপি: ${recipeName})` : ""}।`,
        items,
        tip: hasLowStock ? "কম স্টকের আইটেম দ্রুত কিনুন — Inventory → Purchase Memo।" : "ফার্মের ফিড সাপ্লাই ভালো আছে।",
      };
    }

    // ── বিক্রির পরামর্শ ───────────────────────────────────────────────────────
    if (question === "sell_ready") {
      const { data: cattleData } = await supabase
        .from("cattle")
        .select("id, tag_id, target_weight_kg, purchase_price, purchase_date, initial_weight_kg")
        .eq("business_id", businessId)
        .eq("status", "active")
        .is("deleted_at", null);

      const activeCattle = (cattleData ?? []) as {
        id: string; tag_id: string; target_weight_kg: number | null;
        purchase_price: number; purchase_date: string; initial_weight_kg: number;
      }[];

      if (activeCattle.length === 0) {
        return {
          ok: true,
          title: "বিক্রির পরামর্শ",
          summary: "কোনো সক্রিয় গরু নেই।",
          items: [],
          tip: "গরু যোগ করুন।",
        };
      }

      const activeIds = activeCattle.map((c) => c.id);

      const [{ data: weightData }, { data: feedData }, { data: bizConfig }] = await Promise.all([
        supabase
          .from("weight_logs")
          .select("cattle_id, weight_kg, recorded_at")
          .in("cattle_id", activeIds)
          .is("deleted_at", null)
          .order("recorded_at", { ascending: false }),
        supabase
          .from("inventory_transactions")
          .select("cattle_id, qty, unit_cost")
          .in("cattle_id", activeIds)
          .eq("type", "consumption"),
        supabase
          .from("businesses")
          .select("unit_price_bdt")
          .eq("id", businessId)
          .maybeSingle(),
      ]);

      const unitPrice: number = (bizConfig as { unit_price_bdt?: number } | null)?.unit_price_bdt ?? 0;

      const latestWeightMap: Record<string, number> = {};
      for (const log of (weightData ?? []) as { cattle_id: string; weight_kg: number }[]) {
        if (!(log.cattle_id in latestWeightMap)) latestWeightMap[log.cattle_id] = log.weight_kg;
      }

      const feedCostMap: Record<string, number> = {};
      for (const row of (feedData ?? []) as { cattle_id: string | null; qty: number; unit_cost: number | null }[]) {
        if (row.cattle_id) feedCostMap[row.cattle_id] = (feedCostMap[row.cattle_id] ?? 0) + row.qty * (row.unit_cost ?? 0);
      }

      type Candidate = { tag_id: string; id: string; reason: string; priority: number };
      const candidates: Candidate[] = [];

      for (const c of activeCattle) {
        const currentWeight = latestWeightMap[c.id] ?? null;
        const daysInPen = Math.floor(
          (now.getTime() - new Date(c.purchase_date + "T00:00:00").getTime()) / 86_400_000
        );
        const totalCost = Number(c.purchase_price) + (feedCostMap[c.id] ?? 0);
        const saleValue = currentWeight && unitPrice > 0 ? currentWeight * unitPrice : null;
        const profit = saleValue !== null ? saleValue - totalCost : null;
        const profitStr = profit !== null ? ` — সম্ভাব্য ${profit >= 0 ? "লাভ" : "লোকসান"} ${bdtFmt(profit)}` : "";

        if (c.target_weight_kg && currentWeight && currentWeight >= c.target_weight_kg) {
          candidates.push({ id: c.id, tag_id: c.tag_id, priority: 1,
            reason: `লক্ষ্য ওজন পৌঁছেছে (${currentWeight.toFixed(0)} kg / লক্ষ্য ${c.target_weight_kg} kg)${profitStr}` });
        } else if (daysInPen > 180 && currentWeight) {
          candidates.push({ id: c.id, tag_id: c.tag_id, priority: 2,
            reason: `দীর্ঘদিন পেনে আছে (${daysInPen} দিন)${profitStr}` });
        } else if (profit !== null && profit < 0 && daysInPen > 90) {
          candidates.push({ id: c.id, tag_id: c.tag_id, priority: 3,
            reason: `লোকসানে আছে — এখন পর্যন্ত ${bdtFmt(Math.abs(profit))} ঘাটতি` });
        }
      }

      candidates.sort((a, b) => a.priority - b.priority);

      const items: AdvisorItem[] = candidates.slice(0, 6).map((c) => ({
        label: `গরু #${c.tag_id}`,
        value: c.reason,
        status: c.priority === 1 ? "ok" : c.priority === 2 ? "warning" : "danger",
        href: `/dashboard/cattle/${c.id}`,
      }));

      if (items.length === 0) {
        items.push({
          label: "এখনই বিক্রির দরকার নেই",
          value: "কোনো গরু লক্ষ্য ওজনে পৌঁছায়নি বা সমস্যায় নেই",
          status: "ok",
        });
      }

      return {
        ok: true,
        title: "বিক্রির পরামর্শ",
        summary: candidates.length === 0
          ? "এখনই বিক্রির তাড়া নেই। গরুগুলো বাড়ছে।"
          : `${candidates.length}টি গরু বিক্রির জন্য বিবেচনা করতে পারেন।`,
        items,
        tip: unitPrice === 0
          ? "Settings-এ বাজার মূল্য (৳/kg) সেট করুন — তাহলে লাভ/লোকসানের হিসাব দেখাবে।"
          : "বিক্রির আগে বাজার দর যাচাই করুন।",
      };
    }

    // ── স্বাস্থ্য রিপোর্ট ─────────────────────────────────────────────────────
    if (question === "health_status") {
      const [
        { count: overdueCount },
        { data: upcomingData },
        { data: quarantinedData },
        { data: activeCattleData },
        { data: vaccineData },
      ] = await Promise.all([
        supabase
          .from("health_events")
          .select("*", { count: "exact", head: true })
          .eq("business_id", businessId)
          .lt("scheduled_at", todayStr)
          .is("completed_at", null)
          .is("deleted_at", null),
        supabase
          .from("health_events")
          .select("title, scheduled_at")
          .eq("business_id", businessId)
          .gte("scheduled_at", todayStr)
          .lte("scheduled_at", in7Days)
          .is("completed_at", null)
          .is("deleted_at", null)
          .limit(5),
        supabase
          .from("cattle")
          .select("tag_id")
          .eq("business_id", businessId)
          .eq("is_quarantined", true)
          .eq("status", "active")
          .is("deleted_at", null),
        supabase
          .from("cattle")
          .select("id")
          .eq("business_id", businessId)
          .eq("status", "active")
          .is("deleted_at", null),
        supabase
          .from("health_events")
          .select("cattle_id")
          .eq("business_id", businessId)
          .eq("event_type", "vaccine")
          .not("completed_at", "is", null)
          .is("deleted_at", null),
      ]);

      const totalActive = (activeCattleData ?? []).length;
      const vaccinatedIds = new Set(
        (vaccineData ?? []).map((v: { cattle_id: string }) => v.cattle_id)
      );
      const vaccinatedCount = (activeCattleData ?? []).filter(
        (c: { id: string }) => vaccinatedIds.has(c.id)
      ).length;

      const quarantined = (quarantinedData ?? []) as { tag_id: string }[];
      const upcoming = (upcomingData ?? []) as { title: string; scheduled_at: string }[];

      const items: AdvisorItem[] = [
        {
          label: "Overdue ইভেন্ট",
          value: (overdueCount ?? 0) === 0 ? "✓ কোনো বাকি নেই" : `${overdueCount}টি ইভেন্ট সম্পন্ন করুন`,
          status: (overdueCount ?? 0) === 0 ? "ok" : (overdueCount ?? 0) > 3 ? "danger" : "warning",
          href: (overdueCount ?? 0) > 0 ? "/dashboard/cattle/health" : undefined,
        },
        {
          label: "আগামী ৭ দিনের ইভেন্ট",
          value: upcoming.length === 0 ? "✓ কিছু নেই" : `${upcoming.length}টি ইভেন্ট আসছে`,
          status: upcoming.length > 0 ? "info" : "ok",
          href: upcoming.length > 0 ? "/dashboard/compliance" : undefined,
        },
        {
          label: "টিকা দেওয়া হয়েছে",
          value: totalActive > 0 ? `${vaccinatedCount}/${totalActive} গরু` : "—",
          status: totalActive === 0 ? "info" :
                  vaccinatedCount === totalActive ? "ok" :
                  vaccinatedCount > 0 ? "warning" : "danger",
          href: "/dashboard/compliance",
        },
      ];

      if (quarantined.length > 0) {
        items.push({
          label: "কোয়ারেন্টাইনে",
          value: quarantined.map((c) => `#${c.tag_id}`).join(", "),
          status: "warning",
          href: "/dashboard/cattle",
        });
      }

      const isHealthy = (overdueCount ?? 0) === 0 && quarantined.length === 0;

      return {
        ok: true,
        title: "স্বাস্থ্য রিপোর্ট",
        summary: isHealthy
          ? "ফার্মের স্বাস্থ্য পরিস্থিতি ভালো।"
          : `${(overdueCount ?? 0) + quarantined.length}টি জরুরি স্বাস্থ্য সমস্যা আছে।`,
        items,
        tip: isHealthy
          ? "নিয়মিত টিকা ও চেকআপ চালিয়ে যান।"
          : "Compliance পেজে গিয়ে টিকার বিস্তারিত দেখুন।",
      };
    }

    // ── মাসের পারফরম্যান্স ────────────────────────────────────────────────────
    if (question === "monthly_performance") {
      const [
        { data: salesData },
        { data: costsData },
        { data: weightLogsData },
        { data: activeCattleData },
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("sale_price_total, cattle!inner(business_id)")
          .eq("cattle.business_id", businessId)
          .gte("sold_at", monthStart)
          .is("deleted_at", null),
        supabase
          .from("cost_entries")
          .select("amount")
          .eq("business_id", businessId)
          .gte("recorded_at", monthStart)
          .is("deleted_at", null)
          .neq("entry_class", "asset"),
        supabase
          .from("weight_logs")
          .select("cattle_id, weight_kg, recorded_at, cattle!inner(business_id, status)")
          .eq("cattle.business_id", businessId)
          .eq("cattle.status", "active")
          .gte("recorded_at", sevenDaysAgo)
          .is("deleted_at", null),
        supabase
          .from("cattle")
          .select("id")
          .eq("business_id", businessId)
          .eq("status", "active")
          .is("deleted_at", null),
      ]);

      const revenue = ((salesData ?? []) as { sale_price_total: number }[])
        .reduce((s, r) => s + Number(r.sale_price_total), 0);
      const costs = ((costsData ?? []) as { amount: number }[])
        .reduce((s, c) => s + Number(c.amount), 0);
      const netPL = revenue - costs;
      const activeCount = (activeCattleData ?? []).length;

      // Herd ADG from recent weight logs
      type WLog = { cattle_id: string; weight_kg: number; recorded_at: string };
      const logsPerCattle: Record<string, WLog[]> = {};
      for (const log of (weightLogsData ?? []) as WLog[]) {
        if (!logsPerCattle[log.cattle_id]) logsPerCattle[log.cattle_id] = [];
        logsPerCattle[log.cattle_id].push(log);
      }
      const adgValues: number[] = [];
      for (const logs of Object.values(logsPerCattle)) {
        if (logs.length < 2) continue;
        const sorted = [...logs].sort(
          (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
        );
        const days =
          (new Date(sorted[0].recorded_at).getTime() - new Date(sorted[sorted.length - 1].recorded_at).getTime()) /
          86_400_000;
        if (days >= 3) adgValues.push((sorted[0].weight_kg - sorted[sorted.length - 1].weight_kg) / days);
      }
      const avgADG = adgValues.length > 0 ? adgValues.reduce((s, v) => s + v, 0) / adgValues.length : null;

      const monthName = now.toLocaleDateString("en-BD", { month: "long", year: "numeric" });

      const items: AdvisorItem[] = [
        {
          label: "এই মাসের বিক্রি",
          value: revenue > 0 ? bdtFmt(revenue) : "কোনো বিক্রি নেই",
          status: revenue > 0 ? "ok" : "info",
          href: "/dashboard/finance",
        },
        {
          label: "এই মাসের খরচ",
          value: costs > 0 ? bdtFmt(costs) : "৳০",
          status: "info",
          href: "/dashboard/finance",
        },
      ];

      if (revenue > 0) {
        items.push({
          label: "নিট লাভ / লোকসান",
          value: `${netPL >= 0 ? "+" : "−"}${bdtFmt(netPL)}`,
          status: netPL >= 0 ? "ok" : "danger",
          href: "/dashboard/finance",
        });
      }

      items.push({
        label: "সক্রিয় গরু",
        value: `${activeCount}টি`,
        status: "info",
        href: "/dashboard/cattle",
      });

      if (avgADG !== null) {
        items.push({
          label: "গড় দৈনিক বৃদ্ধি (ADG)",
          value: `${avgADG.toFixed(2)} kg/দিন`,
          status: avgADG >= 0.5 ? "ok" : avgADG >= 0.3 ? "warning" : "danger",
          href: "/dashboard/cattle/analytics",
        });
      }

      return {
        ok: true,
        title: `${monthName} পারফরম্যান্স`,
        summary:
          revenue === 0
            ? `এই মাসে কোনো বিক্রি হয়নি। ${activeCount}টি গরু সক্রিয়।`
            : netPL >= 0
            ? `এই মাসে ${bdtFmt(netPL)} লাভ হয়েছে।`
            : `এই মাসে ${bdtFmt(Math.abs(netPL))} লোকসান হয়েছে।`,
        items,
        tip:
          avgADG !== null && avgADG < 0.4
            ? "ADG কম — খাদ্যের মান ও পরিমাণ পর্যালোচনা করুন।"
            : "Finance পেজে বিস্তারিত বিশ্লেষণ দেখুন।",
      };
    }

    return { ok: false, error: "Unknown question" };
  } catch (err) {
    console.error("[advisor]", err);
    return { ok: false, error: "বিশ্লেষণ করতে সমস্যা হয়েছে।" };
  }
}
