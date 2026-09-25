"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bookmark, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedView } from "./types";
import { useL } from "@/i18n/text";

export interface DataGridSavedViewsProps {
  savedViews: SavedView[];
  activeViewId: string | null;
  onApplyView: (view: SavedView) => void;
  onSaveView: (name: string) => void;
  onDeleteView: (id: string) => void;
}

export function DataGridSavedViews({
  savedViews,
  activeViewId,
  onApplyView,
  onSaveView,
  onDeleteView,
}: DataGridSavedViewsProps) {
  const L = useL();
  const [newViewName, setNewViewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSave = () => {
    if (!newViewName.trim()) return;
    onSaveView(newViewName.trim());
    setNewViewName("");
    setIsCreating(false);
  };

  return (
    <Popover>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 text-xs cursor-pointer")}
      >
        <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{L("সংরক্ষিত ভিউ", "Views")}</span>
        {activeViewId && (
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 space-y-2.5 bg-card border-border shadow-xl">
        <div className="flex items-center justify-between border-b border-border pb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider">Saved Views</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-[11px] text-primary"
            onClick={() => setIsCreating(!isCreating)}
          >
            {isCreating ? L("বাতিল", "Cancel") : L("+ এটা সেভ করুন", "+ Save current")}
          </Button>
        </div>

        {isCreating && (
          <div className="flex gap-1.5 pt-1">
            <Input
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder={L("ভিউর নাম…", "View name...")}
              className="h-7 text-xs flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSave}>
              {L("সেভ", "Save")}
            </Button>
          </div>
        )}

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {savedViews.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-2">
              {L("কোনো সংরক্ষিত ভিউ নেই", "No saved views yet")}
            </div>
          ) : (
            savedViews.map((view) => {
              const isActive = view.id === activeViewId;
              return (
                <div
                  key={view.id}
                  className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    isActive ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/50"
                  }`}
                  onClick={() => onApplyView(view)}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isActive && <Check className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{view.name}</span>
                  </div>
                  {!view.isDefault && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteView(view.id);
                      }}
                      className="text-muted-foreground hover:text-destructive p-1 rounded"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
