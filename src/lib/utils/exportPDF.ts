import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportOptions {
  title: string;
  filename: string;
  columns: string[];
  data: (string | number)[][];
  summary?: Record<string, string | number>;
}

export function generatePDF({ title, filename, columns, data, summary }: ExportOptions) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(45, 106, 53); // Emerald/Green theme
  doc.text("Chowdhury Agro", 14, 22);
  
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(title, 14, 30);
  
  const dateStr = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", 
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
  doc.setFontSize(10);
  doc.text(`Generated on: ${dateStr}`, 14, 38);

  // Main Table
  autoTable(doc, {
    startY: 45,
    head: [columns],
    body: data,
    theme: "striped",
    headStyles: { fillColor: [45, 106, 53] },
    margin: { top: 45 },
  });

  // Summary Section (if provided)
  if (summary) {
    // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
    const finalY = doc.lastAutoTable?.finalY || 45;
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Financial Summary", 14, finalY + 15);
    
    const summaryData = Object.entries(summary).map(([key, val]) => [key, val]);
    
    autoTable(doc, {
      startY: finalY + 20,
      body: summaryData,
      theme: "plain",
      styles: { cellPadding: 2, fontSize: 11 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 80 },
        1: { halign: "right" }
      }
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  doc.save(`${filename}.pdf`);
}
