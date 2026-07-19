import { CattleSubNav } from "@/components/cattle/CattleSubNav";

export default function CattleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <CattleSubNav />
      <div>{children}</div>
    </div>
  );
}
