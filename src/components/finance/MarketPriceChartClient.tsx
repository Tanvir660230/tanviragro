"use client";

import { useState, useTransition } from "react";
import {
  TrendingUp,
  Plus,
  Check,
  X,
  Trash2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import {
  upsertMarketPrice,
  deleteMarketPrice,
} from "@/app/dashboard/(app)/market-price-actions";

export type PriceRow = {
  date: string;
  price_per_kg: number;
  notes: string | null;
};

// Local date string YYYY-MM-DD in the device timezone
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
  });
}

function fmtDateLong(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export function MarketPriceChartClient({
  initialPrices,
}: {
  initialPrices: PriceRow[];
}) {
  const [prices, setPrices] = useState<PriceRow[]>(initialPrices);
  const [adding, setAdding] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [isPending, startTransition] = useTransition();

  // Computed once on mount — today's date doesn't change within a session
  const [today] = useState(localToday);
  const latest = prices[0] ?? null;

  // Chart needs chronological order
  const chartData = [...prices]
    .reverse()
    .slice(-12)
    .map((p) => ({ date: fmtDate(p.date), price: p.price_per_kg }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(priceInput);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("সঠিক মূল্য দিন");
      return;
    }
    startTransition(async () => {
      const res = await upsertMarketPrice(today, price, notesInput.trim());
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("বাজার দর সংরক্ষিত হয়েছে");
        const newEntry: PriceRow = {
          date: today,
          price_per_kg: price,
          notes: notesInput.trim() || null,
        };
        setPrices((prev) => {
          const without = prev.filter((p) => p.date !== today);
          return [newEntry, ...without].sort((a, b) =>
            b.date.localeCompare(a.date)
          );
        });
        setPriceInput("");
        setNotesInput("");
        setAdding(false);
      }
    });
  };

  const handleDelete = (date: string) => {
    startTransition(async () => {
      const res = await deleteMarketPrice(date);
      if (res.error) toast.error(res.error);
      else {
        toast.success("মুছে ফেলা হয়েছে");
        setPrices((prev) => prev.filter((p) => p.date !== date));
      }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">বাজার দর লগ</h3>
          <span className="text-xs text-muted-foreground">(৳/kg)</span>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          আজকের দর
        </button>
      </div>

      {/* ── Current price ── */}
      <div className="px-5 pt-4 pb-3">
        {latest ? (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl font-bold tabular-nums text-foreground">
              ৳{latest.price_per_kg.toLocaleString("en-IN")}
            </span>
            <span className="text-sm text-muted-foreground">/kg</span>
            <span className="text-xs text-muted-foreground">
              — {fmtDateLong(latest.date)}
            </span>
            {latest.notes && (
              <span className="text-xs text-muted-foreground italic">
                ({latest.notes})
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            এখনো কোনো বাজার দর রেকর্ড করা হয়নি।
          </p>
        )}
      </div>

      {/* ── Add price form ── */}
      {adding && (
        <form
          onSubmit={handleSubmit}
          className="px-5 pb-4 flex flex-wrap items-end gap-2 border-b border-border/40"
        >
          <div className="flex-1 min-w-[110px]">
            <label className="block text-xs text-muted-foreground mb-1">
              আজকের দর (৳/kg)
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              required
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="যেমন: 450"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-muted-foreground mb-1">
              নোট (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="বাজারের নাম, সূত্র…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-2 self-end pb-0.5">
            <button
              type="submit"
              disabled={isPending || !priceInput}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
            >
              <Check className="h-4 w-4" />
              সংরক্ষণ
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-border px-3 py-2 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* ── Recharts area chart ── */}
      {chartData.length >= 2 && (
        <div className="px-2 pt-1 pb-2">
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="mpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `৳${v}`}
                width={46}
              />
              <Tooltip
                formatter={(v: any) => [`৳${v}/kg`, "দর"]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#mpGrad)"
                dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Recent entries list ── */}
      {prices.length > 0 && (
        <div className="border-t border-border/40 max-h-[200px] overflow-y-auto divide-y divide-border/30">
          {prices.slice(0, 10).map((p) => (
            <div
              key={p.date}
              className="group flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors"
            >
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {fmtDateLong(p.date)}
              </span>
              <span className="flex-1 text-sm font-semibold tabular-nums">
                ৳{p.price_per_kg.toLocaleString("en-IN")}/kg
              </span>
              {p.notes && (
                <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                  {p.notes}
                </span>
              )}
              <button
                onClick={() => handleDelete(p.date)}
                disabled={isPending}
                title="মুছুন"
                className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-red-500 transition-all disabled:pointer-events-none"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
