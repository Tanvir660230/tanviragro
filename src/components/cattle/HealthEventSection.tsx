"use client";

import { useActionState, useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, Plus, Trash2, Syringe, Stethoscope, Bug, Pill, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createHealthEvent,
  completeHealthEvent,
  deleteHealthEvent,
} from "@/app/dashboard/(app)/cattle/[id]/health-actions";
import type { HealthEvent, HealthEventType } from "@/types/database";
import { useTranslation } from "@/i18n/I18nProvider";
import type { Dictionary } from "@/i18n/getDictionary";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

const EVENT_ICON: Record<HealthEventType, React.ReactNode> = {
  vaccine: <Syringe className="h-4 w-4" />,
  checkup: <Stethoscope className="h-4 w-4" />,
  deworming: <Bug className="h-4 w-4" />,
  treatment: <Pill className="h-4 w-4" />,
  other: <Calendar className="h-4 w-4" />,
};

// We need to pass 't' dynamically, so EVENT_LABEL is moved inside the component.

const EVENT_COLOR: Record<HealthEventType, string> = {
  vaccine: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  checkup: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  deworming: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  treatment: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  other: "bg-muted text-muted-foreground",
};

interface Props {
  cattleId: string;
  businessId: string;
  events: HealthEvent[];
}

export function HealthEventSection({ cattleId, businessId, events }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [eventType, setEventType] = useState<HealthEventType>("vaccine");

  const EVENT_LABEL_SAFE: Record<HealthEventType, string> = {
    vaccine: t.cattle_details.health.vaccine,
    checkup: t.cattle_details.health.checkup,
    deworming: t.cattle_details.health.deworming,
    treatment: t.cattle_details.health.treatment,
    other: t.cattle_details.health.other,
  };

  const [state, formAction, isSubmitting] = useActionState(createHealthEvent, undefined);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(t.cattle_details.health.event_added);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
    }
    if (state?.error) toast.error(state.error);
  }, [state, t]);

  const today = new Date().toISOString().slice(0, 10);

  const pending = events.filter((e) => !e.completed_at);
  const completed = events.filter((e) => e.completed_at);

  const overdue = pending.filter((e) => e.scheduled_at < today);
  const upcoming = pending.filter((e) => e.scheduled_at >= today);

  function handleComplete(eventId: string) {
    startTransition(async () => {
      await completeHealthEvent(eventId, cattleId);
    });
  }

  function confirmDelete(eventId: string) {
    setPendingDeleteId(eventId);
  }

  function handleDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    startTransition(async () => {
      await deleteHealthEvent(id, cattleId);
      toast.success(t.cattle_details.health.event_deleted);
    });
  }

  return (
    <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border bg-blue-50/50 dark:bg-blue-950/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
            <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-sm font-semibold">{t.cattle_details.health.health_calendar}</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5 h-7 text-xs px-2.5")}>
            <Plus className="h-3.5 w-3.5" />
            {t.cattle_details.health.add_event}
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t.cattle_details.health.add_new_event}</DialogTitle>
            </DialogHeader>
            <form
              action={(fd) => {
                fd.set("cattle_id", cattleId);
                fd.set("business_id", businessId);
                fd.set("event_type", eventType);
                formAction(fd);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="cattle_id" value={cattleId} />
              <input type="hidden" name="business_id" value={businessId} />

              <div className="space-y-1.5">
                <Label>{t.cattle_details.health.event_type_label}</Label>
                <Select value={eventType} onValueChange={(v) => setEventType(v as HealthEventType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EVENT_LABEL_SAFE) as HealthEventType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {EVENT_LABEL_SAFE[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="title">
                  {t.cattle_details.health.title} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  placeholder={t.cattle_details.health.title_placeholder}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scheduled_at">
                  {t.cattle_details.health.scheduled_date} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="scheduled_at"
                  name="scheduled_at"
                  type="date"
                  required
                  defaultValue={today}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">{t.cattle_details.health.notes}</Label>
                <Textarea id="notes" name="notes" rows={2} maxLength={500} placeholder={t.cattle_details.health.optional} />
              </div>

              {state?.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t.cattle_details.photos.cancel}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t.cattle_details.health.adding : t.cattle_details.health.save}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
              <Calendar className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">{t.cattle_details.health.no_health_events}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {overdue.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-destructive">{t.cattle_details.health.overdue} ({overdue.length})</p>
                {overdue.map((e) => (
                  <EventRow key={e.id} event={e} onComplete={handleComplete} onDelete={confirmDelete} isPending={isPending} labels={EVENT_LABEL_SAFE} t={t} />
                ))}
              </div>
            )}

            {upcoming.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{t.cattle_details.health.upcoming} ({upcoming.length})</p>
                {upcoming.map((e) => (
                  <EventRow key={e.id} event={e} onComplete={handleComplete} onDelete={confirmDelete} isPending={isPending} labels={EVENT_LABEL_SAFE} t={t} />
                ))}
              </div>
            )}

            {completed.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none">
                  {t.cattle_details.health.completed} ({completed.length}) ?
                </summary>
                <div className="mt-2 space-y-2">
                  {completed.map((e) => (
                    <EventRow key={e.id} event={e} onComplete={handleComplete} onDelete={confirmDelete} isPending={isPending} done labels={EVENT_LABEL_SAFE} t={t} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={t.cattle_details.health.delete_title}
        description={t.cattle_details.health.delete_desc}
        confirmLabel={t.cattle_details.weight.delete}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}

function EventRow({
  event,
  onComplete,
  onDelete,
  isPending,
  done = false,
  labels,
  t,
}: {
  event: HealthEvent;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
  done?: boolean;
  labels: Record<HealthEventType, string>;
  t: Dictionary;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !done && event.scheduled_at < today;

  return (
    <div className={cn(
      "flex items-start gap-3 rounded-lg p-3 ring-1",
      done ? "bg-muted/30 ring-border opacity-60"
        : isOverdue ? "bg-red-50 dark:bg-red-950/30 ring-red-200 dark:ring-red-800"
        : "bg-card ring-border"
    )}>
      <span
        className={cn("mt-0.5 rounded p-1", EVENT_COLOR[event.event_type])}
        aria-label={labels[event.event_type]}
      >
        {EVENT_ICON[event.event_type]}
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", done && "line-through")}>
          {event.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {done ? `${t.cattle_details.health.completed_label}:` : `${t.cattle_details.health.scheduled_label}:`}{" "}
            {new Date(done ? event.completed_at! : event.scheduled_at).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span className={cn("rounded px-1.5 py-0.5 font-medium", EVENT_COLOR[event.event_type])}>
            {labels[event.event_type]}
          </span>
        </div>
        {event.notes && (
          <p className="mt-1 text-xs text-muted-foreground">{event.notes}</p>
        )}
      </div>

      <div className="flex shrink-0 gap-1">
        {!done && (
          <button
            onClick={() => onComplete(event.id)}
            disabled={isPending}
            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
            aria-label="Mark complete"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(event.id)}
          disabled={isPending}
          className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
