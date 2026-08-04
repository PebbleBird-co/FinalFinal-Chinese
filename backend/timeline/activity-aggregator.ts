import type { FileFamily } from '../contracts/family-clustering';
import type { RawFileMetadata } from '../contracts/scan';
import type { DailyActivity } from '../contracts/timeline-risk';

export function isoDay(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function buildFileFamilyMap(families: FileFamily[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const family of families) {
    for (const fileId of family.fileIds) result.set(fileId, family.id);
  }
  return result;
}

export function aggregateDailyActivity(
  files: RawFileMetadata[],
  families: FileFamily[],
): DailyActivity[] {
  const familyByFile = buildFileFamilyMap(families);
  const buckets = new Map<
    string,
    {
      fileIds: Set<string>;
      createdFileIds: Set<string>;
      modifiedFileIds: Set<string>;
      familyIds: Set<string>;
      finalMarkerCount: number;
    }
  >();

  for (const file of files) {
    const date = isoDay(file.modifiedAt);
    const bucket = buckets.get(date) ?? {
      fileIds: new Set<string>(),
      createdFileIds: new Set<string>(),
      modifiedFileIds: new Set<string>(),
      familyIds: new Set<string>(),
      finalMarkerCount: 0,
    };
    bucket.fileIds.add(file.id);
    bucket.modifiedFileIds.add(file.id);
    if (file.createdAt && isoDay(file.createdAt) === date) bucket.createdFileIds.add(file.id);
    const familyId = familyByFile.get(file.id);
    if (familyId) bucket.familyIds.add(familyId);
    if (file.analysis.versionTokens.some((token) => token.category === 'final' || token.category === 'submitted')) {
      bucket.finalMarkerCount += 1;
    }
    buckets.set(date, bucket);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, bucket]) => ({
      date,
      fileCount: bucket.fileIds.size,
      createdFileCount: bucket.createdFileIds.size,
      modifiedFileCount: bucket.modifiedFileIds.size,
      activeFamilyCount: bucket.familyIds.size,
      finalMarkerCount: bucket.finalMarkerCount,
    }));
}
