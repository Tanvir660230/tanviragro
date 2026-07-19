import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Exclude: Next internals, static assets, and ALL /api/* routes.
  // API routes use their own bearer-token auth (cron secret, etc.) and must
  // not be intercepted by the session proxy — they'd get an HTML /login
  // redirect instead of the expected JSON response.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
