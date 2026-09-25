import { redirect } from "next/navigation";

// The recipe-scaled feed mixer is replaced by dated mixes (Inventory → Mix): each mix keeps
// its own quantities, so the recipe changes by date without editing anything.
export default function FeedMixerPage() {
  redirect("/dashboard/inventory/mix");
}
