"use client";

import { Printer, Download, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PrintExportButton() {
  function handlePrint() {
    window.print();
  }

  function handleExportCSV() {
    // Export the cattle detail data visible on page as CSV via clipboard
    const tables = document.querySelectorAll("table");
    if (!tables.length) {
      window.print();
      return;
    }
    const rows: string[][] = [];
    tables.forEach((table) => {
      table.querySelectorAll("tr").forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll("th, td")).map(
          (cell) => `"${cell.textContent?.trim().replace(/"/g, '""') ?? ""}"`
        );
        if (cells.length) rows.push(cells);
      });
      rows.push([]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cattle-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-card hover:bg-accent hover:text-accent-foreground transition-colors print:hidden">
        <Printer className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handlePrint} className="gap-2 cursor-pointer">
          <Printer className="h-4 w-4 text-muted-foreground" />
          Print / PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
          <Download className="h-4 w-4 text-muted-foreground" />
          Export CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
