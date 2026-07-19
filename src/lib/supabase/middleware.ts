import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            // Persist session for 30 days so farm workers aren't logged out on weak networks
            supabaseResponse.cookies.set(name, value, {
              ...options,
              maxAge: options?.maxAge ?? 60 * 60 * 24 * 30,
            })
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publicPaths = ["/login", "/forgot-password", "/reset-password", "/auth/callback", "/auth/confirm"];
  const isAuthRoute = publicPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // RBAC: check role for protected routes
  if (user) {
    const path = request.nextUrl.pathname;
    const adminOnlyPaths = [
      "/dashboard/finance",
      "/dashboard/settings",
      "/dashboard/accounting",
      "/dashboard/report",
    ];
    const isAdminPath = adminOnlyPaths.some((p) => path.startsWith(p));

    if (isAdminPath) {
      const role = user.user_metadata?.role as string | undefined;
      // Owner (no role in metadata) and explicit "admin" have full access.
      // manager / worker are redirected to the cattle page.
      const isWorkerOrManager = role && role !== "admin";
      if (isWorkerOrManager) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/cattle";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
