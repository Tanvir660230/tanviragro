"use client";

import React, { useState, useEffect } from "react";
import { useShell } from "./ShellContext";
import { Calculator, FileText, CheckSquare, X, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function RightUtilityPanel() {
  const { isUtilityOpen, setUtilityOpen, activeUtilityTab, setActiveUtilityTab } = useShell();
  const [noteContent, setNoteContent] = useState("");
  const [tasks, setTasks] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [newTaskInput, setNewTaskInput] = useState("");
  const [calcInput, setCalcInput] = useState("");
  const [calcResult, setCalcResult] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedNote = localStorage.getItem("tanvir_farm_notes");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedNote) setNoteContent(savedNote);
      const savedTasks = localStorage.getItem("tanvir_farm_tasks");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedTasks) setTasks(JSON.parse(savedTasks));
    } catch {}
  }, []);

  const handleSaveNote = (val: string) => {
    setNoteContent(val);
    try { localStorage.setItem("tanvir_farm_notes", val); } catch {}
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    const updated = [...tasks, { id: Date.now().toString(), text: newTaskInput.trim(), done: false }];
    setTasks(updated);
    setNewTaskInput("");
    try { localStorage.setItem("tanvir_farm_tasks", JSON.stringify(updated)); } catch {}
  };

  const handleToggleTask = (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setTasks(updated);
    try { localStorage.setItem("tanvir_farm_tasks", JSON.stringify(updated)); } catch {}
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    try { localStorage.setItem("tanvir_farm_tasks", JSON.stringify(updated)); } catch {}
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sanitized = calcInput.replace(/[^0-9+\-*/().]/g, "");
      if (!sanitized) return;
      const res = Function(`"use strict"; return (${sanitized})`)();
      setCalcResult(String(res));
    } catch {
      setCalcResult("Error");
    }
  };

  if (!isUtilityOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setUtilityOpen(false)} />
      <aside className={cn("fixed top-0 right-0 bottom-0 z-50 w-full sm:w-80 md:w-96 bg-card border-l border-border shadow-2xl flex flex-col", "lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:z-30 lg:shadow-none")}>
        <div className="flex items-center justify-between px-4 h-12 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-1">
            <button onClick={() => setActiveUtilityTab("calculator")} className={cn("p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5", activeUtilityTab === "calculator" ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
              <Calculator className="h-4 w-4" /><span>Calc</span>
            </button>
            <button onClick={() => setActiveUtilityTab("notes")} className={cn("p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5", activeUtilityTab === "notes" ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
              <FileText className="h-4 w-4" /><span>Notes</span>
            </button>
            <button onClick={() => setActiveUtilityTab("tasks")} className={cn("p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5", activeUtilityTab === "tasks" ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
              <CheckSquare className="h-4 w-4" /><span>Tasks</span>
            </button>
          </div>
          <button onClick={() => setUtilityOpen(false)} className="p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {activeUtilityTab === "calculator" && (
            <form onSubmit={handleCalculate} className="space-y-3 bg-muted/40 p-3 rounded-xl">
              <input type="text" placeholder="Formula e.g. 350*0.027" value={calcInput} onChange={(e) => setCalcInput(e.target.value)} className="w-full h-9 px-3 rounded-lg bg-background border border-input text-xs font-mono" />
              <div className="flex justify-between items-center"><button type="submit" className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-lg">Run</button>{calcResult !== null && <span className="text-xs font-mono font-bold">= {calcResult}</span>}</div>
            </form>
          )}
          {activeUtilityTab === "notes" && <textarea value={noteContent} onChange={(e) => handleSaveNote(e.target.value)} placeholder="Farm notes..." className="w-full h-64 p-3 rounded-xl bg-muted/20 border border-input text-xs resize-none" />}
          {activeUtilityTab === "tasks" && (
            <div className="space-y-2">
              <form onSubmit={handleAddTask} className="flex gap-2"><input type="text" placeholder="New task..." value={newTaskInput} onChange={(e) => setNewTaskInput(e.target.value)} className="flex-1 h-8 px-2 rounded-lg bg-background border border-input text-xs" /><button type="submit" className="px-2 bg-primary text-primary-foreground rounded-lg"><Plus className="h-3 w-3" /></button></form>
              <div className="space-y-1">{tasks.map((t) => (<div key={t.id} className="flex items-center justify-between p-2 rounded-lg border text-xs"><span onClick={() => handleToggleTask(t.id)} className={cn("cursor-pointer", t.done && "line-through text-muted-foreground")}>{t.text}</span><button onClick={() => handleDeleteTask(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button></div>))}</div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
