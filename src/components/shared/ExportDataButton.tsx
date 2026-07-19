"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/export";
import { toast } from "sonner";

interface ExportDataButtonProps {
  data: Record<string, unknown>[];
  filename: string;
}

export function ExportDataButton({ data, filename }: ExportDataButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) {
      toast.error("No data available to export");
      return;
    }
    
    downloadCSV(data, filename);
    toast.success("Export successful", {
      description: `Downloaded ${filename}.csv`
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
      <Download className="h-4 w-4" />
      Export to Excel (CSV)
    </Button>
  );
}
