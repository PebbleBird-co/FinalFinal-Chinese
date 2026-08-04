import type { ScanResult } from './scan';

export interface ExportPdfInput {
  result: ScanResult;
  overrideCount: number;
}

export interface ExportPdfResult {
  canceled: boolean;
  outputPath?: string;
}
