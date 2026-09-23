import { HealthSubNav } from "@/components/health/HealthSubNav";

export default function HealthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <HealthSubNav />
      <div>{children}</div>
    </div>
  );
}