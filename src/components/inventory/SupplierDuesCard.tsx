"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { paySupplierDue } from "@/app/dashboard/(app)/inventory/purchase/actions";

export type SupplierDue = { id: string; lender: string; outstanding: number; since: string };

const TEXT = {
  bn: { title: "দোকানের বাকি", sub: "দোকানে টাকা দিলে এখানে লিখুন — নগদ থেকে সেদিন কাটা হবে", since: "থেকে", pay: "শোধ লিখুন", amount: "টাকা", date: "তারিখ", save: "সেভ", cancel: "বাতিল", all: "পুরোটা", saved: "বাকি শোধ সেভ হলো", total: "মোট বাকি" },
  en: { title: "Supplier dues", sub: "Record a payment to a shop here — it leaves cash on that day", since: "since", pay: "Record payment", amount: "Amount", date: "Date", save: "Save", cancel: "Cancel", all: "All of it", saved: "Payment saved", total: "Total due" },
};

const taka = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function SupplierDuesCard({ dues, today, lang }: { dues: SupplierDue[]; today: string; lang: "bn" | "en" }) {
  const t = TEXT[lang];
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [pending, start] = useTransition();
  if (dues.length === 0) return null;
  const total = dues.reduce((s, d) => s + d.outstanding, 0);

  function save(d: SupplierDue) {
    const fd = new FormData();
    fd.set("id", d.id); fd.set("amount", amount); fd.set("date", date);
    start(async () => {
      const res = await paySupplierDue(fd);
      if (res.error) { toast.error(res.error); return; }
      toast.success(t.saved);
      setOpen(null); setAmount("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-amber-500/20 bg-card shadow-card" aria-label={t.title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Store className="h-4 w-4 text-amber-600" aria-hidden />{t.title}</h2>
          <p className="text-xs text-muted-foreground">{t.sub}</p>
        </div>
        <p className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">{t.total}: {taka(total)}</p>
      </div>
      <ul className="divide-y divide-border/60">
        {dues.map((d) => (
          <li key={d.id} className="px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.lender}</p>
                <p className="text-xs text-muted-foreground">{d.since} {t.since}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">{taka(d.outstanding)}</span>
                {open !== d.id && (
                  <Button type="button" size="sm" variant="outline" onClick={() => { setOpen(d.id); setAmount(String(d.outstanding)); setDate(today); }}>{t.pay}</Button>
                )}
              </div>
            </div>
            {open === d.id && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="grid gap-1 text-xs text-muted-foreground">{t.amount}
                  <Input type="number" inputMode="decimal" min={0} max={d.outstanding} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 w-32" />
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">{t.date}
                  <Input type="date" value={date} min={d.since} max={today} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
                </label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAmount(String(d.outstanding))}>{t.all}</Button>
                <Button type="button" size="sm" disabled={pending} onClick={() => save(d)}>{t.save}</Button>
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(null)}>{t.cancel}</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
