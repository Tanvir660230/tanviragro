"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { AnimalWizardDocument } from "@/lib/validation/cattle-wizard";
import { FileText, Plus, Trash2, Link2 } from "lucide-react";
import { useState } from "react";

interface Props {
  documents: AnimalWizardDocument[];
  notes: string;
  onDocumentsChange: (docs: AnimalWizardDocument[]) => void;
  onNotesChange: (notes: string) => void;
}

export function Step7Documents({ documents, notes, onDocumentsChange, onNotesChange }: Props) {
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docType, setDocType] = useState("Certificate");

  const addDoc = () => {
    if (!docName.trim() || !docUrl.trim()) return;
    onDocumentsChange([
      ...documents,
      {
        id: "doc-" + Date.now(),
        name: docName.trim(),
        type: docType,
        url: docUrl.trim(),
      },
    ]);
    setDocName("");
    setDocUrl("");
  };

  const removeDoc = (id: string) => {
    onDocumentsChange(documents.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* General Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="generalNotes" className="text-xs font-semibold">
          General Notes & Observations
        </Label>
        <Textarea
          id="generalNotes"
          rows={3}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Enter any distinct marks, temperament notes, horns, or general remarks..."
        />
      </div>

      {/* Attachments */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          Document Links & Health Certificates
        </Label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            placeholder="Document title (e.g. DLS Certificate)"
            className="text-xs h-8"
          />
          <Input
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="URL (e.g. https://...)"
            className="text-xs h-8"
          />
          <div className="flex gap-1.5">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="Certificate">Certificate</option>
              <option value="Invoice">Receipt / Invoice</option>
              <option value="Medical">Medical Report</option>
            </select>
            <Button type="button" size="sm" onClick={addDoc} className="h-8 text-xs px-2.5">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {documents.length > 0 && (
          <div className="space-y-1.5 mt-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-2 rounded-md border border-border bg-card text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-medium truncate">{doc.name}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {doc.type}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeDoc(doc.id)}
                  className="text-muted-foreground hover:text-rose-500 transition-colors p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
