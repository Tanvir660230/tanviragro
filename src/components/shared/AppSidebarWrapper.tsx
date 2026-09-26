import { AppSidebar } from "./AppSidebar";
import { getBusinessContext } from "@/lib/context/business-context";

/** The sidebar, from the request's one business context (no queries of its own). */
export async function AppSidebarWrapper() {
  const ctx = await getBusinessContext().catch(() => null);
  if (!ctx) return <AppSidebar isAdmin={false} business={null} role="viewer" />;
  return (
    <AppSidebar
      isAdmin={ctx.isAdmin}
      role={ctx.role}
      business={{ name: ctx.business.name ?? undefined, logo_url: (ctx.business as { logo_url?: string | null }).logo_url ?? null }}
      userEmail={ctx.user.email}
    />
  );
}
