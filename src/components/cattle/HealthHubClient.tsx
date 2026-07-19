"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  CheckCircle2,
  Trash2,
  Syringe,
  Stethoscope,
  Bug,
  Pill,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCheck,
  HeartPulse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  completeHealthEventHub,
  deleteHealthEventHub,
} from "@/app/dashboard/(app)/cattle/health/actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { HubEventRow } from "@/app/dashboard/(app)/cattle/health/page";

type Props = {
  events: HubEventRow[];
  todayISO: string;
  in7ISO: string;
  stats: {
    overdue: number;
    thisWeek: number;
    completedThisMonth: number;
  };
};

type FilterTab = "all" | "overdue" | "week" | "later";

const EVENT_ICON: Record<HubEventRow["event_type"], React.ReactNode> = {
  vaccine:   <Syringe    className="h-4 w-4" />,
  checkup:   <Stethoscope className="h-4 w-4" />,
  deworming: <Bug        className="h-4 w-4" />,
  treatment: <Pill       className="h-4 w-4" />,
  other:     <Calendar   className="h-4 w-4" />,
};

const EVENT_COLOR: Record<HubEventRow["event_type"], string> = {
  vaccine:   "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  checkup:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  deworming: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  treatment: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  other:     "bg-muted text-muted-foreground",
};

const EVENT_LABEL: Record<HubEventRow["event_type"], string> = {
  vaccine:   "Vaccine",
  checkup:   "Checkup",
  deworming: "Deworming",
  treatment: "Treatment",
  other:     "Other",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

function daysAgo(iso: string, todayISO: string): number {
  const diff =
    new Date(todayISO).getTime() - new Date(iso + "T00:00:00").getTime();
  return Math.floor(diff / 86400000);
}

function daysUntil(iso: string, todayISO: string): number {
  const diff =
    new Date(iso + "T00:00:00").getTime() - new Date(todayISO).getTime();
  return Math.floor(diff / 86400000);
}

export function HealthHubClient({ events, todayISO, in7ISO, stats }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = events.filter((e) => !removedIds.has(e.id));

  const overdue = visible.filter((e) => e.scheduled_at < todayISO);
  const thisWeek = visible.filter(
    (e) => e.scheduled_at >= todayISO && e.scheduled_at <= in7ISO
  );
  const later = visible.filter((e) => e.scheduled_at > in7ISO);

  const filtered =
    activeFilter === "overdue" ? overdue
    : activeFilter === "week"  ? thisWeek
    : activeFilter === "later" ? later
    : visible;

  function handleComplete(eventId: string) {
    setRemovedIds((prev) => new Set([...prev, eventId]));
    startTransition(async () => {
      const res = await completeHealthEventHub(eventId);
      if (res?.error) {
        toast.error(res.error);
        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      } else {
        toast.success("Event marked as completed");
      }
    });
  }

  function handleDeleteConfirm() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    setRemovedIds((prev) => new Set([...prev, id]));
    startTransition(async () => {
      const res = await deleteHealthEventHub(id);
      if (res?.error) {
        toast.error(res.error);
        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        toast.success("Event deleted");
      }
    });
  }

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "all",     label: "All",       count: visible.length },
    { id: "overdue", label: "Overdue",   count: overdue.length },
    { id: "week",    label: "This Week", count: thisWeek.length },
    { id: "later",   label: "Later",     count: later.length },
  ];

  return (
    <>
      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Overdue"
          value={stats.overdue}
          color={stats.overdue > 0 ? "destructive" : "muted"}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="This Week"
          value={stats.thisWeek}
          color={stats.thisWeek > 0 ? "warning" : "muted"}
        />
        <StatCard
          icon={<CheckCheck className="h-4 w-4" />}
          label="Done This Month"
          value={stats.completedThisMonth}
          color="success"
        />
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all",
              activeFilter === tab.id
                ? "bg-primary text-primary-foreground shadow-card"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums",
                activeFilter === tab.id
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Event List ── */}
      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState filter={activeFilter} />
        ) : (
          <div className="divide-y divide-border">
            {/* Grouped view for "all" tab */}
            {activeFilter === "all" ? (
              <>
                {overdue.length > 0 && (
                  <EventGroup
                    label="Overdue"
                    labelColor="text-destructive"
                    events={overdue}
                    todayISO={todayISO}
                    in7ISO={in7ISO}
                    isPending={isPending}
                    onComplete={handleComplete}
                    onDelete={setPendingDeleteId}
                  />
                )}
                {thisWeek.length > 0 && (
                  <EventGroup
                    label="This Week"
                    labelColor="text-amber-600 dark:text-amber-400"
                    events={thisWeek}
                    todayISO={todayISO}
                    in7ISO={in7ISO}
                    isPending={isPending}
                    onComplete={handleComplete}
                    onDelete={setPendingDeleteId}
                  />
                )}
                {later.length > 0 && (
                  <EventGroup
                    label="Later"
                    labelColor="text-muted-foreground"
                    events={later}
                    todayISO={todayISO}
                    in7ISO={in7ISO}
                    isPending={isPending}
                    onComplete={handleComplete}
                    onDelete={setPendingDeleteId}
                  />
                )}
              </>
            ) : (
              filtered.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  todayISO={todayISO}
                  in7ISO={in7ISO}
                  isPending={isPending}
                  onComplete={handleComplete}
                  onDelete={setPendingDeleteId}
                />
              ))
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Health Event"
        description="This will soft-delete the event and remove it from all views. The record is preserved for compliance."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "destructive" | "warning" | "success" | "muted";
}) {
  const styles = {
    destructive: {
      bg:   value > 0 ? "bg-red-50/60 dark:bg-red-950/15 border border-red-200/70 dark:border-red-800/40" : "bg-muted/30 border border-border/60",
      icon: value > 0 ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-muted text-muted-foreground",
      text: value > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
    },
    warning: {
      bg:   value > 0 ? "bg-amber-50/60 dark:bg-amber-950/15 border border-amber-200/70 dark:border-amber-800/40" : "bg-muted/30 border border-border/60",
      icon: value > 0 ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted text-muted-foreground",
      text: value > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
    },
    success: {
      bg:   "bg-emerald-50/60 dark:bg-emerald-950/15 border border-emerald-200/70 dark:border-emerald-800/40",
      icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    muted: {
      bg:   "bg-muted/30 border border-border/60",
      icon: "bg-muted text-muted-foreground",
      text: "text-muted-foreground",
    },
  }[color];

  return (
    <div className={cn("rounded-xl p-3 sm:p-4 space-y-2", styles.bg)}>
      <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", styles.icon)}>
        {icon}
      </div>
      <div>
        <p className={cn("text-2xl font-bold tabular-nums leading-none", styles.text)}>{value}</p>
        <p className="mt-1 text-xs font-medium text-muted-foreground leading-snug">{label}</p>
      </div>
    </div>
  );
}

function EventGroup({
  label,
  labelColor,
  events,
  todayISO,
  in7ISO,
  isPending,
  onComplete,
  onDelete,
}: {
  label: string;
  labelColor: string;
  events: HubEventRow[];
  todayISO: string;
  in7ISO: string;
  isPending: boolean;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
        <p className={cn("text-xs font-semibold uppercase tracking-wider", labelColor)}>
          {label} ({events.length})
        </p>
      </div>
      {events.map((event) => (
        <EventRow
          key={event.id}
          event={event}
          todayISO={todayISO}
          in7ISO={in7ISO}
          isPending={isPending}
          onComplete={onComplete}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function EventRow({
  event,
  todayISO,
  in7ISO,
  isPending,
  onComplete,
  onDelete,
}: {
  event: HubEventRow;
  todayISO: string;
  in7ISO: string;
  isPending: boolean;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isOverdue = event.scheduled_at < todayISO;
  const isThisWeek = !isOverdue && event.scheduled_at <= in7ISO;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors",
        isOverdue
          ? "bg-red-50/60 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20"
          : isThisWeek
          ? "bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50/80 dark:hover:bg-amber-950/20"
          : "hover:bg-muted/30"
      )}
    >
      {/* Type icon */}
      <span className={cn("mt-0.5 rounded-lg p-1.5 shrink-0", EVENT_COLOR[event.event_type])}>
        {EVENT_ICON[event.event_type]}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-sm font-semibold leading-tight">{event.title}</p>
          <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium shrink-0", EVENT_COLOR[event.event_type])}>
            {EVENT_LABEL[event.event_type]}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {event.cattle && (
            <Link
              href={`/dashboard/cattle/${event.cattle_id}`}
              className="font-semibold text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
            >
              #{event.cattle.tag_id}
              {event.cattle.breed && (
                <span className="ml-1 font-normal text-muted-foreground">
                  · {event.cattle.breed}
                </span>
              )}
            </Link>
          )}
          <span>·</span>
          <span
            className={cn(
              "font-medium",
              isOverdue ? "text-destructive" : isThisWeek ? "text-amber-600 dark:text-amber-400" : ""
            )}
          >
            {isOverdue
              ? `${daysAgo(event.scheduled_at, todayISO)}d overdue`
              : event.scheduled_at === todayISO
              ? "Today"
              : `In ${daysUntil(event.scheduled_at, todayISO)}d`}
          </span>
          <span>·</span>
          <span>{formatDate(event.scheduled_at)}</span>
        </div>

        {event.notes && (
          <p className="text-xs text-muted-foreground/80 line-clamp-1" title={event.notes}>
            {event.notes}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onComplete(event.id)}
          disabled={isPending}
          title="Mark complete"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCircle2 className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={() => onDelete(event.id)}
          disabled={isPending}
          title="Delete event"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterTab }) {
  const messages: Record<FilterTab, { title: string; desc: string }> = {
    all:     { title: "All clear!", desc: "No pending health events. Your herd is healthy." },
    overdue: { title: "No overdue events", desc: "All health events are on schedule." },
    week:    { title: "Nothing this week", desc: "No events scheduled for the next 7 days." },
    later:   { title: "Nothing scheduled later", desc: "No events beyond the next 7 days." },
  };
  const { title, desc } = messages[filter];

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
        <HeartPulse className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">{desc}</p>
      </div>
    </div>
  );
}
