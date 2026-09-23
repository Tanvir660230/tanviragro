import type { GridColumn } from "./types";

export function sanitizeExportValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    if (val instanceof Date) return val.toISOString();
    return JSON.stringify(val);
  }
  return String(val);
}

export function extractColumnValue<T>(row: T, col: GridColumn<T>, index: number): string {
  if (col.accessorFn) {
    return sanitizeExportValue(col.accessorFn(row));
  }
  if (col.accessorKey) {
    return sanitizeExportValue(row[col.accessorKey]);
  }
  return "";
}

export function exportToCsv<T>(
  data: T[],
  columns: GridColumn<T>[],
  filename: string = "export.csv"
): void {
  if (!data || data.length === 0 || !columns || columns.length === 0) return;

  const validColumns = columns.filter((col) => !col.hidden && col.id !== "__selection__" && col.id !== "__actions__");
  const headers = validColumns.map((col) => {
    const text = typeof col.header === "string" ? col.header : col.id;
    return `"${text.replace(/"/g, '""')}"`;
  });

  const rows = data.map((row, idx) => {
    return validColumns
      .map((col) => {
        const val = extractColumnValue(row, col, idx);
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel<T>(
  data: T[],
  columns: GridColumn<T>[],
  filename: string = "export.xlsx"
): void {
  if (!data || data.length === 0 || !columns || columns.length === 0) return;

  const validColumns = columns.filter((col) => !col.hidden && col.id !== "__selection__" && col.id !== "__actions__");
  const headers = validColumns.map((col) => (typeof col.header === "string" ? col.header : col.id));

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Sheet1">
  <Table>
   <Row>`;

  for (const h of headers) {
    xml += `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
  }
  xml += `</Row>`;

  data.forEach((row, idx) => {
    xml += `<Row>`;
    validColumns.forEach((col) => {
      const val = extractColumnValue(row, col, idx);
      const isNum = !isNaN(Number(val)) && val.trim() !== "";
      if (isNum) {
        xml += `<Cell><Data ss:Type="Number">${val.trim()}</Data></Cell>`;
      } else {
        xml += `<Cell><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;
      }
    });
    xml += `</Row>`;
  });

  xml += `</Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".xls") || filename.endsWith(".xlsx") ? filename : `${filename}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

export async function exportToPdf<T>(
  data: T[],
  columns: GridColumn<T>[],
  title: string = "Enterprise Data Export",
  filename: string = "export.pdf"
): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({
      orientation: columns.length > 6 ? "landscape" : "portrait",
      unit: "pt",
      format: "a4",
    });

    const validColumns = columns.filter((col) => !col.hidden && col.id !== "__selection__" && col.id !== "__actions__");
    const head = [validColumns.map((col) => (typeof col.header === "string" ? col.header : col.id))];
    
    const body = data.map((row, idx) => {
      return validColumns.map((col) => extractColumnValue(row, col, idx));
    });

    doc.setFontSize(16);
    doc.text(title, 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()} | Total: ${data.length}`, 40, 56);

    autoTable(doc, {
      head,
      body,
      startY: 70,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 40, right: 40 },
    });

    doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } catch (err) {
    console.error("Failed to generate PDF:", err);
    printDataGrid(data, columns, title);
  }
}

export function printDataGrid<T>(
  data: T[],
  columns: GridColumn<T>[],
  title: string = "Enterprise Data Grid Report"
): void {
  if (typeof window === "undefined") return;

  const validColumns = columns.filter((col) => !col.hidden && col.id !== "__selection__" && col.id !== "__actions__");
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #111827; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .meta { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
          th { background: #f3f4f6; font-weight: 600; }
          tr:nth-child(even) td { background: #fafafa; }
          @media print { body { padding: 0; } @page { margin: 1cm; size: landscape; } }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">Exported: ${new Date().toLocaleString()} | Total Records: ${data.length}</div>
        <table>
          <thead>
            <tr>${validColumns.map((col) => `<th>${typeof col.header === "string" ? col.header : col.id}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${data.map((row, idx) => `<tr>${validColumns.map((col) => `<td>${escapeXml(extractColumnValue(row, col, idx))}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
        <script>
          window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
