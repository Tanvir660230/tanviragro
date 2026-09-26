import Image from "next/image";
import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

/** The farm's mark: its logo when set, else a leaf on the brand green — the same in the sidebar, menu and header. */
export function BrandMark({ logoUrl, name, size = 36, className }: { logoUrl?: string | null; name: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-sm ring-1 ring-black/5", className)}
      style={{ width: size, height: size }}
    >
      {logoUrl
        ? <Image src={logoUrl} alt={name} fill sizes={`${size}px`} className="object-cover" />
        : <Sprout className="h-[55%] w-[55%]" strokeWidth={2.2} aria-hidden />}
    </span>
  );
}
