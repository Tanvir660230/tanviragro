"use client";

import React, { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { EnterprisePageHeader } from "@/components/layout/PageHeader";
import { DescriptionList, type DescriptionItem } from "@/components/enterprise-ui/DescriptionList";
import { ActivityTimeline, type TimelineEvent } from "@/components/enterprise-ui/ActivityTimeline";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Edit, Trash2, Printer, FileText, Activity } from "lucide-react";

export interface UniversalDetailsPageProps {
  title: string;
  subtitle?: string;
  badge?: string;
  backHref: string;
  overviewItems: DescriptionItem[];
  timelineEvents?: TimelineEvent[];
  sidebarSummary?: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onPrint?: () => void;
  customTabs?: { id: string; label: string; content: React.ReactNode }[];
  className?: string;
}

export function UniversalDetailsPage(props: UniversalDetailsPageProps) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <PageContainer maxWidth="wide" className={props.className}>
      <EnterprisePageHeader
        title={props.title}
        subtitle={props.subtitle}
        badge={props.badge}
        backHref={props.backHref}
        actions={
          <div className="flex items-center gap-2">
            {props.onPrint && (
              <button
                onClick={props.onPrint}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted border border-border"
              >
                <Printer className="h-4 w-4" />
                <span>Print</span>
              </button>
            )}
            {props.onEdit && (
              <button
                onClick={props.onEdit}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
            )}
            {props.onDelete && (
              <button
                onClick={props.onDelete}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-card border border-border p-1 rounded-xl h-11">
              <TabsTrigger value="overview" className="text-xs font-semibold">
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Overview
              </TabsTrigger>
              {props.timelineEvents && props.timelineEvents.length > 0 && (
                <TabsTrigger value="timeline" className="text-xs font-semibold">
                  <Activity className="h-3.5 w-3.5 mr-1.5" />
                  Activity ({props.timelineEvents.length})
                </TabsTrigger>
              )}
              {props.customTabs?.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs font-semibold">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="pt-4">
              <div className="p-5 rounded-2xl bg-card border border-border shadow-xs">
                <DescriptionList items={props.overviewItems} columns={2} />
              </div>
            </TabsContent>

            {props.timelineEvents && props.timelineEvents.length > 0 && (
              <TabsContent value="timeline" className="pt-4">
                <div className="p-5 rounded-2xl bg-card border border-border shadow-xs">
                  <ActivityTimeline events={props.timelineEvents} />
                </div>
              </TabsContent>
            )}

            {props.customTabs?.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="pt-4">
                {tab.content}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {props.sidebarSummary && (
          <div className="lg:col-span-4 sticky top-20 space-y-4">
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-foreground font-serif">Key Metrics</h3>
              {props.sidebarSummary}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
