"use client";

import React from "react";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { EnterprisePageHeader, type PageHeaderProps } from "./PageHeader";
import { PageContainer, type PageContainerProps } from "./PageContainer";
import { PageContent, type PageContentProps } from "./PageContent";
import { PageFooter, type PageFooterProps } from "./PageFooter";
import { ActionBar, type ActionBarProps } from "./ActionBar";
import { StickyFooterAction, type StickyFooterActionProps } from "./StickyFooterAction";
import { cn } from "@/lib/utils";

export interface EnterprisePageTemplateProps {
  /** Page Header Configuration */
  header?: PageHeaderProps;
  /** Direct title string shortcut */
  title?: string;
  subtitle?: string;
  /** Primary action slot in header or dedicated action bar */
  actions?: React.ReactNode;
  actionBar?: ActionBarProps;
  /** Summary / KPI stats bar slot */
  summary?: React.ReactNode;
  /** Search and filter controls bar slot */
  filters?: React.ReactNode;
  /** Main body content */
  children: React.ReactNode;
  /** Footer action area */
  footer?: React.ReactNode | PageFooterProps;
  stickyFooter?: StickyFooterActionProps;
  /** Container max-width options */
  maxWidth?: PageContainerProps["maxWidth"];
  /** Show breadcrumb navigation (default true) */
  showBreadcrumb?: boolean;
  /** Main content column grid layout */
  columns?: PageContentProps["columns"];
  gap?: PageContentProps["gap"];
  className?: string;
}

export function EnterprisePageTemplate({
  header,
  title,
  subtitle,
  actions,
  actionBar,
  summary,
  filters,
  children,
  footer,
  stickyFooter,
  maxWidth = "standard",
  showBreadcrumb = true,
  columns,
  gap = "md",
  className,
}: EnterprisePageTemplateProps) {
  const resolvedHeaderProps: PageHeaderProps | null = header
    ? header
    : title
    ? { title, subtitle, actions }
    : null;

  return (
    <PageContainer maxWidth={maxWidth} className={cn("animate-fade-in relative", className)}>
      {showBreadcrumb && <Breadcrumb />}

      {resolvedHeaderProps && <EnterprisePageHeader {...resolvedHeaderProps} />}

      {actionBar && <ActionBar {...actionBar} />}

      {summary && <div className="space-y-4">{summary}</div>}

      {filters && <div className="space-y-4">{filters}</div>}

      <PageContent columns={columns} gap={gap}>
        {children}
      </PageContent>

      {footer && (
        <div className="pt-2">
          {React.isValidElement(footer) ? footer : <PageFooter {...(footer as PageFooterProps)} />}
        </div>
      )}

      {stickyFooter && <StickyFooterAction {...stickyFooter} />}
    </PageContainer>
  );
}

export const EnterprisePage = EnterprisePageTemplate;

