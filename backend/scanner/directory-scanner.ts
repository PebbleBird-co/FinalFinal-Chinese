import type { Dirent, Stats } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import {
  SCAN_LIMITS,
  type RawFileMetadata,
  type ScanProgress,
  type ScanResult,
  type ScanStatus,
  type ScanWarning,
} from '../contracts/scan';
import { isPathInsideRoot } from '../security/path-guard';
import { shouldIgnoreDirectory, shouldIgnoreFile } from './ignore-rules';
import { analyzeFilename } from '../analysis/filename-analyzer';
import { clusterFileFamilies } from '../clustering/family-clusterer';
import { buildVersionGraph } from '../inference/graph-builder';
import { analyzeTimelineAndRisks } from '../timeline/timeline-analyzer';
import { rankMainVersionCandidates } from '../ranking/main-version-ranker';

export interface ScannerFileSystem {
  readDirectory(path: string): Promise<Dirent[]>;
  readMetadata(path: string): Promise<Stats>;
}

export interface ScanDirectoryOptions {
  scanId: string;
  rootPath: string;
  signal?: AbortSignal;
  maxFiles?: number;
  maxDepth?: number;
  onProgress?: (progress: ScanProgress) => void;
  fileSystem?: ScannerFileSystem;
}

const nodeFileSystem: ScannerFileSystem = {
  readDirectory: (path) => readdir(path, { withFileTypes: true }),
  readMetadata: (path) => lstat(path),
};

function warningMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return `${fallback} (${error.code})`;
  }
  return fallback;
}

export async function scanDirectory(options: ScanDirectoryOptions): Promise<ScanResult> {
  const startedAt = new Date().toISOString();
  const files: RawFileMetadata[] = [];
  const warnings: ScanWarning[] = [];
  const maxFiles = options.maxFiles ?? SCAN_LIMITS.maxFiles;
  const maxDepth = options.maxDepth ?? SCAN_LIMITS.maxDepth;
  const fileSystem = options.fileSystem ?? nodeFileSystem;
  let status: ScanStatus = 'completed';

  const reportProgress = (currentDirectory: string) => {
    options.onProgress?.({
      scanId: options.scanId,
      rootPath: options.rootPath,
      currentDirectory,
      fileCount: files.length,
      warningCount: warnings.length,
    });
  };

  const visitDirectory = async (directoryPath: string, depth: number): Promise<boolean> => {
    if (options.signal?.aborted) {
      status = 'canceled';
      return false;
    }

    reportProgress(directoryPath);

    let entries: Dirent[];
    try {
      entries = await fileSystem.readDirectory(directoryPath);
    } catch (error) {
      warnings.push({
        code: 'DIRECTORY_UNREADABLE',
        path: directoryPath,
        message: warningMessage(error, 'Directory metadata could not be read.'),
      });
      reportProgress(directoryPath);
      return true;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (options.signal?.aborted) {
        status = 'canceled';
        return false;
      }

      const absolutePath = join(directoryPath, entry.name);
      if (!isPathInsideRoot(options.rootPath, absolutePath)) continue;

      if (entry.isSymbolicLink()) {
        warnings.push({
          code: 'SYMBOLIC_LINK_SKIPPED',
          path: absolutePath,
          message: 'Symbolic links are skipped to keep the scan inside the selected directory.',
        });
        continue;
      }

      if (entry.isDirectory()) {
        if (shouldIgnoreDirectory(entry.name)) continue;
        if (depth >= maxDepth) {
          warnings.push({
            code: 'DEPTH_LIMIT_REACHED',
            path: absolutePath,
            message: `Maximum directory depth of ${maxDepth} was reached.`,
          });
          continue;
        }

        const shouldContinue = await visitDirectory(absolutePath, depth + 1);
        if (!shouldContinue) return false;
        continue;
      }

      if (!entry.isFile() || shouldIgnoreFile(entry.name)) continue;
      if (files.length >= maxFiles) {
        warnings.push({
          code: 'FILE_LIMIT_REACHED',
          path: options.rootPath,
          message: `Maximum file count of ${maxFiles} was reached.`,
        });
        status = 'limit_reached';
        return false;
      }

      let metadata: Stats;
      try {
        metadata = await fileSystem.readMetadata(absolutePath);
      } catch (error) {
        warnings.push({
          code: 'FILE_METADATA_UNREADABLE',
          path: absolutePath,
          message: warningMessage(error, 'File metadata could not be read.'),
        });
        continue;
      }

      const relativePath = relative(options.rootPath, absolutePath);
      const parentDirectory = relative(options.rootPath, directoryPath);
      files.push({
        id: `file:${relativePath.replaceAll('\\', '/')}`,
        name: entry.name,
        extension: extname(entry.name).slice(1).toLowerCase(),
        absolutePath,
        relativePath,
        parentDirectory,
        directoryDepth: depth,
        size: metadata.size,
        modifiedAt: metadata.mtime.toISOString(),
        analysis: analyzeFilename(entry.name),
        ...(metadata.birthtimeMs > 0 ? { createdAt: metadata.birthtime.toISOString() } : {}),
      });

      reportProgress(directoryPath);
    }

    return true;
  };

  await visitDirectory(options.rootPath, 0);

  const clustering = clusterFileFamilies(files);
  const versionGraph = buildVersionGraph(files, clustering.families);
  const timeline = analyzeTimelineAndRisks(files, clustering, versionGraph);

  return {
    scanId: options.scanId,
    rootPath: options.rootPath,
    scannedAt: startedAt,
    completedAt: new Date().toISOString(),
    status,
    limits: SCAN_LIMITS,
    files,
    clustering,
    versionGraph,
    timeline,
    mainVersions: rankMainVersionCandidates(
      files,
      clustering.families,
      versionGraph,
      timeline,
    ),
    warnings,
  };
}
