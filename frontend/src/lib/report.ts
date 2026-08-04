import type { ScanResult } from '../../../backend/contracts/scan';

export function projectName(rootPath: string): string {
  const parts = rootPath.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts.at(-1) || '未命名项目';
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function activityRange(result: ScanResult): { start?: string; end?: string } {
  const dates = result.files
    .map((file) => file.modifiedAt)
    .filter((value) => !Number.isNaN(Date.parse(value)))
    .sort();
  return { start: dates[0], end: dates.at(-1) };
}

export function overallConfidence(result: ScanResult): number {
  const values = [
    ...result.clustering.families
      .filter((family) => family.fileIds.length > 1)
      .map((family) => family.confidence),
    ...result.mainVersions.candidates.map((candidate) => candidate.confidence),
    ...result.timeline.events.map((event) => event.confidence),
    ...result.timeline.risks.map((risk) => risk.confidence),
  ];
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function confidenceText(value: number): string {
  if (value >= 0.85) return '高度可能';
  if (value >= 0.7) return '较可能';
  if (value >= 0.55) return '存在一定可能';
  if (value >= 0.4) return '判断不稳定';
  return '无法可靠判断';
}
