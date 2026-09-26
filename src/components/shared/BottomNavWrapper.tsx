import { BottomNav } from "./BottomNav";
import { getBusinessContext } from "@/lib/context/business-context";

/** The phone bar, from the request's one business context (no queries of its own). */
export async function BottomNavWrapper() {
  const ctx = await getBusinessContext().catch(() => null);
  return <BottomNav isAdmin={ctx ? ctx.isAdmin : true} />;
}
