/// <reference types="vite/client" />

import type {
  CancelScanInput,
  DirectorySelection,
  ScanDirectoryInput,
  ScanProgress,
  ScanResult,
} from '../../backend/contracts/scan';
import type { AnalyzeProjectInput, PersistedProjectState } from '../../backend/contracts/override';
import type { ExportPdfInput, ExportPdfResult } from '../../backend/contracts/report';

declare global {
  interface Window {
    readonly fileArchaeologist?: {
      readonly platform: string;
      readonly versions: Readonly<{
        electron: string;
        chrome: string;
      }>;
      selectDirectory(): Promise<DirectorySelection>;
      authorizeDroppedDirectory(file: File): Promise<DirectorySelection>;
      scanDirectory(input: ScanDirectoryInput): Promise<ScanResult>;
      cancelScan(input: CancelScanInput): Promise<boolean>;
      onScanProgress(listener: (progress: ScanProgress) => void): () => void;
      analyzeProject(input: AnalyzeProjectInput): Promise<ScanResult>;
      saveProjectState(state: PersistedProjectState): Promise<void>;
      loadProjectState(): Promise<PersistedProjectState | undefined>;
      exportPdf(input: ExportPdfInput): Promise<ExportPdfResult>;
    };
  }
}

export {};
