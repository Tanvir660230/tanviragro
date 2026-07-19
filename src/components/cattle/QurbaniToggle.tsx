"use client";

import { useState, useTransition } from "react";
import { Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toggleQurbaniMark } from "@/app/dashboard/(app)/cattle/actions";

export function QurbaniToggle({
  cattleId,
  initialMarked,
}: {
  cattleId: string;
  initialMarked: boolean;
}) {
  const [marked, setMarked] = useState(initialMarked);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !marked;
    setMarked(next);
    startTransition(async () => {
      const r = await toggleQurbaniMark(cattleId, next);
      if (r.error) {
        setMarked(!next);
        toast.error(r.error);
      } else {
        toast.success(next ? "কুরবানির জন্য চিহ্নিত করা হয়েছে" : "চিহ্ন সরানো হয়েছে");
      }
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={marked ? "কুরবানির চিহ্ন সরান" : "কুরবানির জন্য চিহ্নিত করুন"}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all border disabled:opacity-60",
        marked
          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
      )}
    >
      <Moon className={cn("h-4 w-4", marked && "fill-emerald-500 text-emerald-500")} />
      {marked ? "কুরবানি চিহ্নিত" : "কুরবানির জন্য চিহ্ন দিন"}
    </button>
  );
}
