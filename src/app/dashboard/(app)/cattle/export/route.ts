import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { todayDhaka } from "@/lib/dates";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";
import { loadCattleBoard } from "@/lib/cattle/board-data";
import { boardCsv } from "@/lib/cattle/board-csv";

/** The cattle list as CSV: the same calculation as the cards (never a third one). */
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const denied = await actionPermissionError(PERMISSIONS.CATTLE_EXPORT);
  if (denied) return new NextResponse(denied, { status: 403 });

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return new NextResponse("Business not found", { status: 404 });

  const today = todayDhaka();
  const board = await loadCattleBoard(supabase, businessId, today);

  return new NextResponse("﻿" + boardCsv(board), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cattle-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
