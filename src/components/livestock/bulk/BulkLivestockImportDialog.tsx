"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ListPlus,
  ArrowLeft,
} from "lucide-react";
import {
  parseLivestockCsv,
  validateBatchImport,
  getBulkLivestockCsvTemplate,
  generateSequentialTags,
  type ValidatedLivestockRow,
  type BatchImportSummary,
} from "@/lib/livestock/bulk-import";
import { bulkImportLivestockAction } from "@/app/dashboard/(app)/cattle/bulk-actions";
import { todayDhaka } from "@/lib/dates";
import { useL } from "@/i18n/text";

export interface BulkLivestockImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTagIds?: string[];
  onSuccess?: () => void;
}

export function BulkLivestockImportDialog({
  open,
  onOpenChange,
  existingTagIds = [],
  onSuccess,
}: BulkLivestockImportDialogProps) {
  const L = useL();
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const [validatedRows, setValidatedRows] = useState<ValidatedLivestockRow[]>([]);
  const [summary, setSummary] = useState<BatchImportSummary | null>(null);

  const [showAutoTag, setShowAutoTag] = useState(false);
  const [tagPrefix, setTagPrefix] = useState("TAG-");
  const [tagStartNum, setTagStartNum] = useState(101);

  const [isPending, startTransition] = useTransition();

  const handleDownloadTemplate = () => {
    const csv = getBulkLivestockCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `livestock_import_template_${todayDhaka()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(L("নমুনা শিট ডাউনলোড হলো", "Template downloaded"));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        processRawText(content);
      }
    };
    reader.readAsText(file);
  };

  const processRawText = (text: string) => {
    const parsed = parseLivestockCsv(text);
    if (parsed.rows.length === 0) {
      toast.error(L("শিটে কোনো ঠিক সারি পাওয়া যায়নি", "No valid rows found"));
      return;
    }
    const result = validateBatchImport(parsed.rows, existingTagIds);
    setValidatedRows(result.validatedRows);
    setSummary(result.summary);
    setStep("preview");
  };

  const handleApplySequentialTags = () => {
    if (validatedRows.length === 0) return;
    const generated = generateSequentialTags(tagPrefix, validatedRows.length, tagStartNum);
    const updated = validatedRows.map((r, i) => {
      const newTag = generated[i];
      const isDup = existingTagIds.includes(newTag);
      return {
        ...r,
        tagId: newTag,
        isValid: !isDup && r.initialWeightKg > 0 && r.errors.filter((e) => !e.includes("Tag")).length === 0,
        errors: isDup ? [`Tag ${newTag} already exists`] : r.errors.filter((e) => !e.includes("Tag")),
      };
    });
    setValidatedRows(updated);
    toast.success(L(`${generated.length}টি ট্যাগ বানানো হলো`, `Generated ${generated.length} tags`));
    setShowAutoTag(false);
  };

  const handleExecuteImport = () => {
    const validRowsToImport = validatedRows.filter((r) => r.isValid);
    if (validRowsToImport.length === 0) {
      toast.error(L("ইমপোর্ট করার মতো ঠিক সারি নেই", "No valid rows to import"));
      return;
    }
    setStep("importing");
    startTransition(async () => {
      try {
        const res = await bulkImportLivestockAction(validRowsToImport);
        if (!res.success) {
          toast.error(res.error || L("ইমপোর্ট হয়নি", "Import failed"));
          setStep("preview");
          return;
        }
        // the animals are in (importing again would duplicate them); a missed cost / plan is a warning
        if (res.error) toast.warning(res.error);
        else toast.success(L(`${res.insertedCount}টি গরু যোগ হলো`, `${res.insertedCount} animals imported`));
        onSuccess?.();
        onOpenChange(false);
        setStep("upload");
        setRawText("");
        setValidatedRows([]);
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || L("সমস্যা হয়েছে", "Something went wrong"));
        setStep("preview");
      }
    });
  };

  const resetAll = () => {
    setStep("upload");
    setRawText("");
    setFileName(null);
    setValidatedRows([]);
    setSummary(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">{L("শিট থেকে গরু যোগ", "Import cattle from a sheet")}</DialogTitle>
                <p className="text-sm text-muted-foreground">{L("CSV ফাইল দিন, বা এক্সেল থেকে কপি করে বসান", "Upload a CSV file, or paste rows copied from Excel")}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-9 shrink-0 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> {L("নমুনা শিট", "Template")}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {step === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center bg-card">
                <UploadCloud className="h-9 w-9 text-muted-foreground mx-auto mb-2" />
                <h3 className="font-semibold text-sm">{L("CSV ফাইল দিন", "Upload a CSV file")}</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-3">
                  {L("ট্যাগ, জাত, ওজন, দাম ও কেনার তারিখসহ ফাইল। নমুনা শিটটি দেখুন।", "A file with tag, breed, weight, price and purchase date — see the template.")}
                </p>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center justify-center rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs">
                    {L("ফাইল বাছুন", "Choose file")}
                  </span>
                  <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={handleFileUpload} />
                </label>
                {fileName && <p className="text-xs font-mono text-primary mt-2">{L("লোড হয়েছে", "Loaded")}: {fileName}</p>}
              </div>

              <div className="space-y-2">
                <Textarea
                  placeholder={L("অথবা এখানে সারিগুলো পেস্ট করুন…", "Or paste the rows here…")}
                  rows={5}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button onClick={() => processRawText(rawText)} disabled={!rawText.trim()} className="w-full text-xs font-semibold gap-2">
                  <RefreshCw className="h-3.5 w-3.5" /> {L("যাচাই করুন", "Check the rows")}
                </Button>
              </div>
            </div>
          )}

          {step === "preview" && summary && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl border bg-card">
                  <span className="text-xs text-muted-foreground">{L("মোট সারি", "Rows")}</span>
                  <p className="text-base font-bold">{summary.totalRows}</p>
                </div>
                <div className="p-2.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                  <span className="text-xs font-semibold">{L("ঠিক আছে", "Valid")}</span>
                  <p className="text-base font-bold">{summary.validRows}</p>
                </div>
                <div className="p-2.5 rounded-xl border bg-card">
                  <span className="text-xs text-muted-foreground">{L("মোট দাম", "Total price")}</span>
                  <p className="text-base font-bold">৳{summary.totalEstimatedAcquisitionCost.toLocaleString()}</p>
                </div>
                <div className="p-2.5 rounded-xl border bg-card">
                  <span className="text-xs text-muted-foreground">{L("মোট ওজন", "Total weight")}</span>
                  <p className="text-base font-bold">{summary.totalInitialWeightKg.toLocaleString()} kg</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/20 text-xs">
                <span>{L("ট্যাগ নেই? ক্রমিক ট্যাগ বানিয়ে নিন", "No tags? Number them in order")}</span>
                <Button size="sm" variant="outline" onClick={() => setShowAutoTag(!showAutoTag)} className="text-xs h-7 gap-1">
                  <ListPlus className="h-3.5 w-3.5" /> {showAutoTag ? L("লুকান", "Hide") : L("ট্যাগ বানান", "Make tags")}
                </Button>
              </div>

              {showAutoTag && (
                <div className="p-2.5 rounded-xl border border-primary/30 bg-primary/5 flex items-center gap-2 flex-wrap text-xs">
                  <Input value={tagPrefix} onChange={(e) => setTagPrefix(e.target.value)} className="h-7 w-20 text-xs font-mono" placeholder={L("শুরু", "Prefix")} />
                  <Input type="number" value={tagStartNum} onChange={(e) => setTagStartNum(parseInt(e.target.value, 10) || 1)} className="h-7 w-16 text-xs font-mono" />
                  <Button size="sm" onClick={handleApplySequentialTags} className="h-7 text-xs">{L("বসান", "Apply")}</Button>
                </div>
              )}

              <div className="border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold border-b sticky top-0 bg-card">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">{L("ট্যাগ", "Tag")}</th>
                      <th className="p-2">{L("জাত", "Breed")}</th>
                      <th className="p-2">{L("লিঙ্গ", "Gender")}</th>
                      <th className="p-2">{L("ওজন", "Weight")}</th>
                      <th className="p-2">{L("দাম", "Price")}</th>
                      <th className="p-2">{L("অবস্থা", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {validatedRows.map((r) => (
                      <tr key={r.rowIndex} className={r.isValid ? "hover:bg-muted/10" : "bg-rose-500/5"}>
                        <td className="p-2 font-mono text-muted-foreground">{r.rowIndex}</td>
                        <td className="p-2 font-mono font-semibold">{r.tagId || "—"}</td>
                        <td className="p-2">{r.breed}</td>
                        <td className="p-2 capitalize">{r.gender}</td>
                        <td className="p-2">{r.initialWeightKg} kg</td>
                        <td className="p-2 font-mono">৳{r.purchasePrice.toLocaleString()}</td>
                        <td className="p-2">
                          {r.isValid ? (
                            <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30">{L("ঠিক", "Valid")}</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">{r.errors[0] || L("ভুল", "Invalid")}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <h3 className="font-semibold text-sm">{L("গরু যোগ হচ্ছে…", "Adding the animals…")}</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {L("গরু, খরচ আর টিকার পরিকল্পনা সেভ হচ্ছে।", "Saving the animals, their costs and vaccine plan.")}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="p-3 border-t bg-muted/20 flex items-center justify-between gap-2">
          {step === "preview" ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={resetAll} className="text-xs gap-1 h-8">
                <ArrowLeft className="h-3.5 w-3.5" /> {L("পেছনে", "Back")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleExecuteImport}
                disabled={isPending || summary?.validRows === 0}
                className="text-xs font-semibold gap-1.5 h-8"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {L(`${summary?.validRows || 0}টি যোগ করুন`, `Import ${summary?.validRows || 0}`)}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs ml-auto h-8">
              {L("বাতিল", "Cancel")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
