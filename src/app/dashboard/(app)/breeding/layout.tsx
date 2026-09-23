import { BreedingSubNav } from "@/components/breeding/BreedingSubNav";

export default function BreedingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <BreedingSubNav />
      <div>{children}</div>
    </div>
  );
}
