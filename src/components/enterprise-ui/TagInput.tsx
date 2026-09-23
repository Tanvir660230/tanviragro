"use client";

import React, { useState, KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  className?: string;
}

export function TagInput({
  tags,
  onChange,
  placeholder = "Type tag and press Enter...",
  maxTags = 10,
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const addTag = () => {
    const trimmed = inputValue.trim().replace(/^,+|,+$/g, "");
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onChange([...tags, trimmed]);
      setInputValue("");
    }
  };

  const removeTag = (idxToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== idxToRemove));
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 min-h-[38px] w-full rounded-xl border border-input bg-background p-1.5 text-xs shadow-xs focus-within:ring-2 focus-within:ring-ring",
        className
      )}
    >
      {tags.map((tag, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-medium border border-primary/20"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(idx)}
            className="hover:text-destructive focus:outline-none p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {tags.length < maxTags && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent border-0 px-1 text-xs focus:outline-none placeholder:text-muted-foreground"
        />
      )}
    </div>
  );
}
