"use client";

import React from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { EnterprisePageHeader } from "@/components/layout/PageHeader";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UniversalFormPageProps {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel?: string;
  onSubmit: (e: React.FormEvent) => void;
  loading?: boolean;
  submitLabel?: string;
  cancelHref?: string;
  children: React.ReactNode;
  className?: string;
}

export function UniversalFormPage({
  title,
  subtitle,
  backHref,
  backLabel = "Cancel and go back",
  onSubmit,
  loading = false,
  submitLabel = "Save Changes",
  cancelHref,
  children,
  className,
}: UniversalFormPageProps) {
  return (
    <PageContainer maxWidth="standard" className={className}>
      <EnterprisePageHeader
        title={title}
        subtitle={subtitle}
        backHref={backHref}
        backLabel={backLabel}
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-6">{children}</div>

        <div className="flex items-center justify-end gap-3 p-4 rounded-2xl bg-card border border-border sticky bottom-4 z-20 shadow-lg">
          <a
            href={cancelHref || backHref}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted border border-border transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Cancel</span>
          </a>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{submitLabel}</span>
          </button>
        </div>
      </form>
    </PageContainer>
  );
}
