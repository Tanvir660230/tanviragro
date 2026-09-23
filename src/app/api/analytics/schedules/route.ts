import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/cached";

export async function GET() {
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

    const { data: schedules, error: scheduleErr } = await (supabase as any)
      .from("report_schedules")
      .select("*, report:custom_reports(title, category)")
      .eq("business_id", bizRow.id)
      .order("created_at", { ascending: false });

    if (scheduleErr) {
      return NextResponse.json({ error: scheduleErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, schedules: schedules || [] });
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
    const { reportId, reportType, frequency, dayOfWeek, dayOfMonth, hourOfDay, format, recipients, channels } = body;

    const { data: inserted, error: insertErr } = await (supabase as any)
      .from("report_schedules")
      .insert({
        business_id: bizRow.id,
        report_id: reportId || null,
        report_type: reportType || "custom",
        frequency: frequency || "weekly",
        day_of_week: dayOfWeek ?? 1,
        day_of_month: dayOfMonth ?? 1,
        hour_of_day: hourOfDay ?? 6,
        format: format || "pdf",
        recipients: recipients || [],
        channels: channels || ["email"],
        is_active: true,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, schedule: inserted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
