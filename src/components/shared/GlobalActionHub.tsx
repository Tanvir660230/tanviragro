"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Plus, X, Beef, Receipt, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CattleForm } from "@/components/cattle/AddCattleDialog";
import { CostForm } from "@/components/finance/AddCostDialog";
import { getGlobalFormData } from "@/app/dashboard/(app)/global-actions";
import { usePathname } from "next/navigation";

type GlobalData = {
  cattle: { id: string; tag_id: string }[];
  existingTags: string[];
  existingBreeds: string[];
  inventoryItems: { id: string; name: string; unit: string; category: string }[];
};

export function GlobalActionHub() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"cattle" | "cost">("cattle");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GlobalData | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Hide hub on non-dashboard pages or auth pages
    if (!pathname?.startsWith("/dashboard")) return;
    
    // Auto-fetch data on mount to ensure quick open
    if (!data && !loading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      getGlobalFormData()
        .then((res) => {
          if (res.success) {
            setData(res as GlobalData);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [pathname, data, loading]);

  if (!pathname?.startsWith("/dashboard")) return null;

  return (
    <>
      {/* The Floating Magic Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 group flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all hover:scale-110 active:scale-95 border-2 border-white/20 dark:border-black/20"
        aria-label="Universal Action Hub"
      >
        <Sparkles className="h-6 w-6 text-white" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-none shadow-2xl rounded-3xl">
          <DialogTitle className="sr-only">Universal Action Hub</DialogTitle>
          
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white relative">
            <h2 className="text-xl font-bold mb-1">Universal Action Hub</h2>
            <p className="text-sm text-white/80">Select an action to quickly record data.</p>
            <button 
              onClick={() => setOpen(false)} 
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 bg-muted/30">
            <div className="grid grid-cols-2 gap-2 p-1 bg-background rounded-xl border">
              <button
                onClick={() => setActiveTab("cattle")}
                className={cn("flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all", activeTab === "cattle" ? "bg-emerald-500 text-white shadow-card" : "text-muted-foreground hover:bg-muted")}
              >
                <Beef className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Add Cow</span>
              </button>
              <button
                onClick={() => setActiveTab("cost")}
                className={cn("flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all", activeTab === "cost" ? "bg-orange-500 text-white shadow-card" : "text-muted-foreground hover:bg-muted")}
              >
                <Receipt className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Expense</span>
              </button>
            </div>
          </div>

          <div className="p-5 max-h-[60vh] overflow-y-auto">
            {!data ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                <p>Loading your farm data...</p>
              </div>
            ) : (
              <>
                {activeTab === "cattle" && (
                  <CattleForm 
                    existingTagIds={data.existingTags} 
                    existingBreeds={data.existingBreeds}
                    onAddAnother={(t: string) => {}}
                    onDone={() => setOpen(false)}
                  />
                )}
                {activeTab === "cost" && (
                  <CostForm
                    formKey={1}
                    onSuccess={() => setOpen(false)}
                  />
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
