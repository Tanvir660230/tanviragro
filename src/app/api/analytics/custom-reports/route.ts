import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/cached";
import { CustomReportEngine } from "@/lib/analytics/custom-report-engine";
import type { CustomReportDefinition } from "@/lib/analytics/types";

export async function GET(req: NextRequest) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: bizRow } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!bizRow) {
      return NextResponse.json({ error: "No active farm business found." }, { status: 404 });
    }

    const { data: savedReports, error: fetchErr } = await (supabase as any)
      .from("custom_reports")
      .select("*")
      .eq("business_id", bizRow.id)
      .order("created_at", { ascending: false });

    if (fetchErr) {
      console.error("Fetch custom reports error:", fetchErr);
    }

    const templates = CustomReportEngine.getDefaultTemplates();

    return NextResponse.json({
      success: true,
      savedReports: savedReports || [],
      templates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: bizRow } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!bizRow) {
      return NextResponse.json({ error: "No active farm business found." }, { status: 404 });
    }

    const body = await req.json();
    const { action, report, dataset, config } = body;

    // Action: "save" -> persist report definition to custom_reports table
    if (action === "save") {
      const reportDef = report as CustomReportDefinition;
      const { data: inserted, error: insertErr } = await (supabase as any)
        .from("custom_reports")
        .insert({
          business_id: bizRow.id,
          title: reportDef.title,
          description: reportDef.description,
          category: reportDef.category || "general",
          dataset: reportDef.dataset,
          config: reportDef.config,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, report: inserted });
    }

    // Action: "execute" -> fetch raw records from target dataset and run CustomReportEngine
    const targetDataset = dataset || report?.dataset || "cattle";
    const reportConfig = config || report?.config || { fields: [] };

    let rawRecords: any[] = [];

    if (targetDataset === "cattle") {
      const { data } = await supabase
        .from("cattle")
        .select("tag_number, breed, gender, status, purchase_price, purchase_weight_kg, current_weight_kg, created_at")
        .eq("business_id", bizRow.id)
        .is("deleted_at", null)
        .limit(2000);
      rawRecords = data || [];
    } else if (targetDataset === "financial_transactions") {
      const { data } = await supabase
        .from("cost_entries")
        .select("id, amount, type, recorded_at, entry_class")
        .eq("business_id", bizRow.id)
        .is("deleted_at", null)
        .limit(5000);
      rawRecords = data || [];
    } else if (targetDataset === "inventory_items") {
      const { data } = await supabase
        .from("inventory_items")
        .select("name, category, unit, current_stock, unit_cost, reorder_threshold")
        .eq("business_id", bizRow.id)
        .is("deleted_at", null)
        .limit(1000);
      rawRecords = data || [];
    } else if (targetDataset === "health_events") {
      const { data } = await supabase
        .from("health_events")
        .select("title, event_type, status, scheduled_at, completed_at, withdrawal_days")
        .eq("business_id", bizRow.id)
        .is("deleted_at", null)
        .limit(1000);
      rawRecords = data || [];
    }

    const executed = CustomReportEngine.executeReport(rawRecords, reportConfig);
    const csvContent = CustomReportEngine.generateCSV(report?.title || "Custom Report", executed.columns, executed.rows);

    return NextResponse.json({
      success: true,
      executed,
      csvContent,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
