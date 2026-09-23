"use client";

import React, { useState } from "react";
import { Send, ShieldCheck, ExternalLink, BrainCircuit, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NlAnalyticsQueryResponse } from "@/lib/ai/types";

export function EnterpriseAiAssistantDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [locale, setLocale] = useState<"en" | "bn">("en");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ role: "user" | "ai"; content: string; responseObj?: NlAnalyticsQueryResponse }>>([
    {
      role: "ai",
      content: "Hello! I am your Enterprise Farm Intelligence Copilot. Ask me about weight gains, feed costs, or overdue vaccines.",
    },
  ]);

  if (!isOpen) return null;

  async function handleSendQuery(textToSend?: string) {
    const q = textToSend || query;
    if (!q.trim()) return;

    setHistory((prev) => [...prev, { role: "user", content: q }]);
    if (!textToSend) setQuery("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/nl-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, locale }),
      });
      const data = await res.json();
      if (data.success && data.response) {
        setHistory((prev) => [...prev, { role: "ai", content: data.response.answerSummary, responseObj: data.response }]);
      }
    } catch {
      setHistory((prev) => [...prev, { role: "ai", content: "Error processing query. Please retry." }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end">
      <div className="bg-background border-l border-border w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-bold text-sm">Enterprise AI Copilot</h3>
              <p className="text-[11px] text-muted-foreground">Decision Support &amp; Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setLocale(locale === "en" ? "bn" : "en")} className="h-7 text-xs">
              {locale === "en" ? "বাংলা" : "EN"}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {history.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 text-xs ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground border border-border/80"}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.responseObj?.directNavigationUrl && (
                  <a href={msg.responseObj.directNavigationUrl} className="mt-2 text-primary hover:underline inline-flex items-center gap-1 text-[11px] font-medium">
                    Open in ERP <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Analyzing telemetry...</span>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-border bg-muted/10">
          <form onSubmit={(e) => { e.preventDefault(); handleSendQuery(); }} className="flex gap-2">
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask a question..." className="flex-1 px-3 py-2 text-xs bg-muted/50 border border-border rounded-lg" />
            <Button type="submit" size="sm" disabled={isLoading || !query.trim()} className="h-8">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
