import { ReportEngine, type ExportDataOptions } from '@/lib/reports/report-engine';

export async function generatePDF(options: ExportDataOptions) {
  return ReportEngine.exportToPDF(options);
}
