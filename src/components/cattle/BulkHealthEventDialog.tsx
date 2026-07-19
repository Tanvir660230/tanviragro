"use client";

import { useActionState, useState, useEffect, useTransition } from "react";
import { CalendarCheck, CheckSquare, Square } from "lucide-react";
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
import { createBulkHealthEvents, type BulkHealthFormState } from "@/app/dashboard/(app)/cattle/actions";
import { useTranslation } from "@/i18n/I18nProvider";
import { toast } from "sonner";

interface CattleOption {
  id: string;
  tag_id: string;
}

interface Props {
  activeCattle: CattleOption[];
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

const EVENT_TYPES = [
  { value: "vaccine", label: "Vaccine" },
  { value: "checkup", label: "Checkup" },
  { value: "deworming", label: "Deworming" },
  { value: "treatment", label: "Treatment" },
  { value: "other", label: "Other" },
] as const;

export function BulkHealthEventDialog({ activeCattle, open: externalOpen, onOpenChange: externalOnChange }: Props) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open    = externalOpen    ?? internalOpen;
  const setOpen = externalOnChange ?? setInternalOpen;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [eventType, setEventType] = useState("vaccine");
  const [state, action, isPending] = useActionState<BulkHealthFormState, FormData>(
    createBulkHealthEvents,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success("Health events scheduled");
      setTimeout(() => {
        setOpen(false);
        setSelectedIds(new Set());
        setEventType("vaccine");
      }, 0);
    }
    if (state?.error) toast.error(state.error);
  }, [state, setOpen]);

  function toggleAll() {
    if (selectedIds.size === activeCattle.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeCattle.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = selectedIds.size === activeCattle.length && activeCattle.length > 0;

  if (activeCattle.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!externalOnChange && (
        <DialogTrigger className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
          <CalendarCheck className="h-4 w-4" />
          {t.cattle_details.smart.bulk_health}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.cattle_details.smart.bulk_health_title}</DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {/* Hidden field: comma-separated selected cattle IDs */}
          <input type="hidden" name="cattle_ids" value={[...selectedIds].join(",")} />
          {/* Hidden event_type (controlled separately) */}
          <input type="hidden" name="event_type" value={eventType} />

          {/* Cattle selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cattle ({selectedIds.size} selected)
              </Label>
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {allSelected ? (
                  <><CheckSquare className="h-3.5 w-3.5" />{t.cattle_details.smart.deselect_all}</>
                ) : (
                  <><Square className="h-3.5 w-3.5" />{t.cattle_details.smart.select_all}</>
                )}
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
              {activeCattle.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleOne(c.id)}
                    className="accent-primary"
                  />
                  <span className="font-medium">#{c.tag_id}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Event title */}
          <div className="space-y-1.5">
            <Label htmlFor="bh_title">
              {t.cattle_details.health.title} *
            </Label>
            <Input
              id="bh_title"
              name="title"
              placeholder={t.cattle_details.health.title_placeholder}
              required
            />
          </div>

          {/* Event type */}
          <div className="space-y-1.5">
            <Label>Event Type</Label>
            <Select value={eventType} onValueChange={(val) => { if (val !== null) setEventType(val); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((et) => (
                  <SelectItem key={et.value} value={et.value}>
                    {et.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scheduled date */}
          <div className="space-y-1.5">
            <Label htmlFor="bh_date">
              {t.cattle_details.health.scheduled_date} *
            </Label>
            <Input id="bh_date" name="scheduled_at" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="bh_notes">{t.cattle_details.dialogs.notes}</Label>
            <Textarea
              id="bh_notes"
              name="notes"
              placeholder={t.cattle_details.dialogs.optional_notes}
              rows={2}
              maxLength={500}
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.cattle_details.dialogs.cancel}
            </Button>
            <Button
              type="submit"
              disabled={isPending || selectedIds.size === 0}
            >
              {isPending
                ? t.cattle_details.smart.scheduling
                : `${t.cattle_details.health.add_event} (${selectedIds.size})`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
