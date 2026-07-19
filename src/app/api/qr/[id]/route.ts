import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const baseUrl = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL ?? "";
  const cattleUrl = `${baseUrl}/dashboard/cattle/${id}`;

  // Return SVG string — avoids all Buffer/ArrayBuffer TypeScript issues
  const svg = await QRCode.toString(cattleUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
