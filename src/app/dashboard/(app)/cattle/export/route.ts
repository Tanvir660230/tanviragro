import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) {
    return new NextResponse("Business not found", { status: 404 });
  }

  const [{ data: cattleData }, { data: weightLogs }, { data: feedItems }] =
    await Promise.all([
      supabase
        .from("cattle")
        .select("id, tag_id, breed, gender, purchase_date, purchase_price, initial_weight_kg, status")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("weight_logs")
        .select("cattle_id, weight_kg, recorded_at, cattle!inner(business_id)")
        .eq("cattle.business_id", businessId)
        .order("recorded_at", { ascending: false }),
      supabase
        .from("inventory_items")
        .select("id")
        .eq("business_id", businessId)
        .eq("category", "feed"),
    ]);

  const feedItemIds = (feedItems ?? []).map((i) => i.id);
  const { data: consumptions } = feedItemIds.length
    ? await supabase
        .from("inventory_transactions")
        .select("cattle_id, qty")
        .eq("type", "consumption")
        .in("item_id", feedItemIds)
    : { data: [] };

  // Latest weight per cattle
  const latestWeightMap: Record<string, number> = {};
  for (const log of (weightLogs ?? []) as { cattle_id: string; weight_kg: number }[]) {
    if (!(log.cattle_id in latestWeightMap)) {
      latestWeightMap[log.cattle_id] = log.weight_kg;
    }
  }

  // Feed consumption per cattle
  const consumeMap: Record<string, number> = {};
  for (const t of (consumptions ?? []) as { cattle_id: string | null; qty: number }[]) {
    if (t.cattle_id) consumeMap[t.cattle_id] = (consumeMap[t.cattle_id] ?? 0) + t.qty;
  }

  const today = new Date().getTime();

  type CattleRow = {
    id: string;
    tag_id: string;
    breed: string | null;
    gender: string;
    purchase_date: string;
    purchase_price: number;
    initial_weight_kg: number;
    status: string;
  };

  const headers = [
    "Tag ID",
    "Breed",
    "Gender",
    "Purchase Date",
    "Purchase Price (৳)",
    "Initial Weight (kg)",
    "Current Weight (kg)",
    "Weight Gain (kg)",
    "Days in Pen",
    "Feed Consumed (kg)",
    "FCR",
    "Status",
  ];

  const rows = (cattleData ?? []).map((c: CattleRow) => {
    const currentWeight = latestWeightMap[c.id] ?? c.initial_weight_kg;
    const weightGain = currentWeight - c.initial_weight_kg;
    const consumed = consumeMap[c.id] ?? 0;
    const fcr = weightGain > 0 && consumed > 0 ? (consumed / weightGain).toFixed(2) : "";
    const daysInPen =
      c.status === "active"
        ? Math.floor((today - new Date(c.purchase_date).getTime()) / 86400000)
        : "";

    return [
      c.tag_id,
      c.breed ?? "",
      c.gender,
      c.purchase_date,
      c.purchase_price,
      c.initial_weight_kg,
      currentWeight.toFixed(1),
      weightGain.toFixed(1),
      daysInPen,
      consumed.toFixed(1),
      fcr,
      c.status,
    ]
      .map((val) => `"${String(val).replace(/"/g, '""')}"`)
      .join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cattle-${date}.csv"`,
    },
  });
}
