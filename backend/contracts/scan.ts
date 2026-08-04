import type { FilenameAnalysis } from './filename-analysis';
import type { FamilyClusteringResult } from './family-clustering';
import type { SerializedVersionGraph } from './version-graph';
import type { TimelineRiskAnalysis } from './timeline-risk';
import type { MainVersionRanking } from './main-version';

export const SCAN_LIMITS = Object.freeze({
  maxFiles: 20_000,
  maxDepth: 20,
});

export type ScanStatus = 'completed' | 'canceled' | 'limit_reached';

export interface DirectorySelection {
  canceled: boolean;
  path?: string;
}

export interface RawFileMetadata {
  id: string;
  name: string;
  extension: string;
  absolutePath: string;
  relativePath: string;
  parentDirectory: string;
  directoryDepth: number;
  size: number;
  modifiedAt: string;
  createdAt?: string;
  analysis: FilenameAnalysis;
}

export type ScanWarningCode =
  | 'DIRECTORY_UNREADABLE'
  | 'FILE_METADATA_UNREADABLE'
  | 'SYMBOLIC_LINK_SKIPPED'
  | 'DEPTH_LIMIT_REACHED'
  | 'FILE_LIMIT_REACHED';

export interface ScanWarning {
  code: ScanWarningCode;
  path: string;
  message: string;
}

export interface ScanProgress {
  scanId: string;
  rootPath: string;
  currentDirectory: string;
  fileCount: number;
  warningCount: number;
}

export interface ScanResult {
  scanId: string;
  rootPath: string;
  scannedAt: string;
  completedAt: string;
  status: ScanStatus;
  limits: typeof SCAN_LIMITS;
  files: RawFileMetadata[];
  clustering: FamilyClusteringResult;
  versionGraph: SerializedVersionGraph;
  timeline: TimelineRiskAnalysis;
  mainVersions: MainVersionRanking;
  warnings: ScanWarning[];
}

export interface ScanDirectoryInput {
  scanId: string;
  rootPath: string;
}

export interface CancelScanInput {
  scanId: string;
}
