"use client";

import React, { useState } from "react";
import { CheckCircle2, MessageSquare, Paperclip, ShieldCheck, Clock, Send, User } from "lucide-react";
import { WorkflowInstance } from "@/lib/workflow-engine/types";
import { enterpriseWorkflowEngine } from "@/lib/workflow-engine";

interface Props {
  instance: WorkflowInstance;
  onUpdate?: () => void;
  currentUser?: { userId: string; userName: string; role: any };
}

export function WorkflowTimelineView({
  instance,
  onUpdate,
  currentUser = { userId: "usr_active", userName: "Manager", role: "manager" },
}: Props) {
  const [commentText, setCommentText] = useState("");

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    enterpriseWorkflowEngine.addComment(instance.instanceId, currentUser, commentText.trim());
    setCommentText("");
    if (onUpdate) onUpdate();
  };

  return (
    <div className="space-y-6">
      {/* Event Timeline */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Timeline & Audit Trail
        </h4>
        <div className="relative border-l border-border pl-4 ml-2 space-y-4">
          {instance.timeline.map((event) => (
            <div key={event.id} className="relative">
              <span className="absolute -left-[21px] top-1 flex h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">{event.title}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Comments Section */}
      <div className="space-y-3 pt-4 border-t border-border">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" /> Notes & Team Discussion ({instance.comments.length})
        </h4>

        {instance.comments.length > 0 && (
          <div className="space-y-2">
            {instance.comments.map((cmt) => (
              <div key={cmt.id} className="rounded-xl border border-border bg-muted/20 p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
                  <span>{cmt.userName} ({cmt.userRole})</span>
                  <span>{new Date(cmt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-foreground">{cmt.content}</p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddComment} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add note or comment..."
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!commentText.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
          >
            <Send className="h-3 w-3" />
          </button>
        </form>
      </div>
    </div>
  );
}
