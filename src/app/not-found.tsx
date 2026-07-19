import Link from "next/link";
import { Home, Beef, Package, BarChart3 } from "lucide-react";

const QUICK_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/cattle", label: "Livestock", icon: Beef },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/finance", label: "Finance", icon: BarChart3 },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center p-6">
      <div className="space-y-2">
        <p className="text-8xl font-black text-muted-foreground/15 select-none leading-none">404</p>
        <p className="text-xl font-semibold text-foreground">Page not found</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          This page does not exist or was moved. Try one of these instead:
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border/80 transition-colors"
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>

      <Link
        href="/dashboard"
        className="text-sm text-primary hover:underline underline-offset-2"
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}
