import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/PageHeader";
import { Sparkles } from "lucide-react";
import { EnterpriseDecisionIntelligenceHub } from "@/components/ai/EnterpriseDecisionIntelligenceHub";

export const metadata: Metadata = {
  title: "AI & Intelligence Hub | Tanvir Agro ERP",
  description: "Predictive foresight, automated proposals, and intelligent farm decision support",
};

export const dynamic = "force-dynamic";

export default async function AiDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <PageHeader
        title="AI & Intelligence Hub"
        subtitle="Predictive livestock analytics, automated workflow proposals, and AI-powered agricultural recommendations."
        icon={Sparkles}
        badge="Active"
        badgeVariant="info"
      />

      <EnterpriseDecisionIntelligenceHub />
    </div>
  );
}
