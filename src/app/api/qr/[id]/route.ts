import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { authenticateApiRoute } from "@/lib/auth/api-guard";
import { assertResourceOwnership } from "@/lib/auth/ownership";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/constants/roles";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiRoute(request, {
    requiredPermission: PERMISSIONS.CATTLE_VIEW,
    rateLimitConfig: { maxRequests: 60, windowMs: 60_000 },
  });

  if ("response" in authResult) {
    return authResult.response;
  }

  const { id } = await params;
  const { auth } = authResult;

  if (auth.type === "user") {
    const supabase = await createClient();
    try {
      await assertResourceOwnership(supabase, "cattle", id, auth.context.businessId);
    } catch {
      return new NextResponse("Not Found or Access Denied", { status: 404 });
    }
  }

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const baseUrl = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL ?? "";
  const cattleUrl = `${baseUrl}/dashboard/cattle/${id}`;

  // Return SVG string
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
