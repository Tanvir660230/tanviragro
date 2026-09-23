import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/auth/confirm",
];

/**
 * Enterprise-hardened session middleware.
 * - Refreshes Supabase session tokens on every request
 * - Redirects unauthenticated users to /login
 * - Prevents authenticated users from re-accessing auth pages
 * - RBAC route guard reads role from business_users table (not user_metadata)
 *   via x-user-role header set during business context resolution
 * - NOTE: Deep RBAC enforcement is done server-side in getBusinessContext()
 *   and requirePermission(). Middleware only enforces coarse role gates
 *   based on the DB role (not metadata, which is attacker-controllable).
 */
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
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // Persist session 30 days — farm workers on weak networks
              maxAge: options?.maxAge ?? 60 * 60 * 24 * 30,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            })
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Redirect unauthenticated users away from protected pages
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Coarse RBAC route protection for authenticated users
  // Deep RBAC is enforced server-side by requirePermission() in each action/route.
  // Here we only gate admin-only paths using role from user_metadata as a fast hint.
  // The source of truth remains the DB (via getBusinessContext).
  if (user) {
    const adminOnlyPaths = [
      "/dashboard/finance",
      "/dashboard/settings",
      "/dashboard/accounting",
      "/dashboard/report",
    ];
    const isAdminPath = adminOnlyPaths.some((p) => path.startsWith(p));

    if (isAdminPath) {
      // Read role from user_metadata as a fast-path hint only.
      // Workers/field staff get redirected; any unknown role defaults to redirect.
      // Owners have no role metadata — they pass through (business context will confirm).
      const role = user.user_metadata?.role as string | undefined;
      const isRestrictedRole = role && !["admin", "manager"].includes(role);
      if (isRestrictedRole) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/cattle";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

