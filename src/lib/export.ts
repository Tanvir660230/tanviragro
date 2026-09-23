import { ReportEngine } from '@/lib/reports/report-engine';

export function downloadCSV(data: Record<string, unknown>[], filename: string) {
  ReportEngine.exportToCSV(data, filename);
}
