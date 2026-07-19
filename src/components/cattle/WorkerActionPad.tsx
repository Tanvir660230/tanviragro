"use client";

import { Dumbbell, Wheat, Syringe, QrCode, Loader2, AlertCircle } from "lucide-react";
import type { Cattle } from "@/types/database";
import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createWeightLog, logFeedConsumption } from "@/app/dashboard/(app)/cattle/[id]/actions";
import { createHealthEvent } from "@/app/dashboard/(app)/cattle/[id]/health-actions";

interface Props {
  cattle: Cattle;
  activeFeedItems: { id: string; name: string }[];
}

// Local date string (YYYY-MM-DD) in user's timezone — avoids UTC shift
function localDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WorkerActionPad({ cattle, activeFeedItems }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [weightOpen, setWeightOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);

  const today = localDateStr();

  const handleAddWeight = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("cattle_id", cattle.id);
    startTransition(async () => {
      await createWeightLog(undefined, fd);
      toast.success("Weight saved");
      router.refresh();
      setWeightOpen(false);
    });
  };

  const handleAddHealth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("cattle_id", cattle.id);
    startTransition(async () => {
      await createHealthEvent(undefined, fd);
      toast.success("Health event saved");
      router.refresh();
      setHealthOpen(false);
    });
  };

  const handleAddFeed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("cattle_id", cattle.id);
    startTransition(async () => {
      const res = await logFeedConsumption(undefined, fd);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Feed consumption saved");
        router.refresh();
        setFeedOpen(false);
      }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-12">
      <div className="text-center space-y-2 mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-2">
          <QrCode className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold">Cattle #{cattle.tag_id}</h2>
        <p className="text-muted-foreground">{cattle.breed} · {cattle.gender}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">

        {/* WEIGHT DIALOG */}
        <Dialog open={weightOpen} onOpenChange={setWeightOpen}>
          <DialogTrigger
            aria-label="Log weight for this cattle"
            className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-6 flex flex-col items-center justify-center border-2 border-blue-200 dark:border-blue-900 shadow-card hover:scale-[1.02] active:scale-100 transition-transform w-full"
          >
            <Dumbbell className="w-10 h-10 text-blue-600 dark:text-blue-400 mb-4" />
            <span className="font-semibold text-blue-800 dark:text-blue-300">Log Weight</span>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Log Weight</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddWeight} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" name="recorded_at" max={today} defaultValue={today} required />
              </div>
              <div className="space-y-1.5">
                <Label>Weight (KG)</Label>
                <Input type="number" name="weight_kg" step="0.1" min="1" max="3000" autoFocus required />
              </div>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* FEED DIALOG */}
        <Dialog open={feedOpen} onOpenChange={setFeedOpen}>
          <DialogTrigger
            aria-label="Log feed consumption for this cattle"
            className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-6 flex flex-col items-center justify-center border-2 border-emerald-200 dark:border-emerald-900 shadow-card hover:scale-[1.02] active:scale-100 transition-transform w-full"
          >
            <Wheat className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mb-4" />
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">Log Feed</span>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Log Feed</DialogTitle>
            </DialogHeader>
            {activeFeedItems.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No feed items available. Ask your manager to add inventory items first.
                </p>
              </div>
            ) : (
              <form onSubmit={handleAddFeed} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Feed Item</Label>
                  <Select name="item_id" required>
                    <SelectTrigger><SelectValue placeholder="Select feed" /></SelectTrigger>
                    <SelectContent>
                      {activeFeedItems.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Quantity (kg)</Label>
                  <Input type="number" name="qty" step="0.1" min="0.1" required autoFocus />
                </div>
                <Input type="hidden" name="recorded_at" value={today} />
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "Save"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* HEALTH DIALOG */}
        <Dialog open={healthOpen} onOpenChange={setHealthOpen}>
          <DialogTrigger
            aria-label="Log health event for this cattle"
            className="bg-rose-50 dark:bg-rose-950/30 rounded-xl p-6 flex flex-col items-center justify-center border-2 border-rose-200 dark:border-rose-900 shadow-card hover:scale-[1.02] active:scale-100 transition-transform w-full"
          >
            <Syringe className="w-10 h-10 text-rose-600 dark:text-rose-400 mb-4" />
            <span className="font-semibold text-rose-800 dark:text-rose-300">Log Health</span>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Log Health Event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddHealth} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select name="type" required>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vaccination">Vaccination</SelectItem>
                    <SelectItem value="deworming">Deworming</SelectItem>
                    <SelectItem value="treatment">Treatment</SelectItem>
                    <SelectItem value="sickness">Sickness</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input type="text" name="description" required />
              </div>
              <Input type="hidden" name="scheduled_at" value={today} />
              <Input type="hidden" name="status" value="completed" />
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-sm text-muted-foreground mt-8 text-center max-w-sm">
        You are in <strong>Worker Mode</strong>. Financial details are hidden. Please log your actions above.
      </p>
    </div>
  );
}
