import { calculateFilenameSimilarity } from '../analysis/filename-similarity';
import type { RawFileMetadata } from '../contracts/scan';
import type {
  VersionEdgeScoreBreakdown,
  VersionEvidence,
  VersionRelation,
} from '../contracts/version-graph';

export interface ScoredParentCandidate {
  sourceFileId: string;
  targetFileId: string;
  confidence: number;
  relation: Exclude<VersionRelation, 'possible_branch'>;
  scoreBreakdown: VersionEdgeScoreBreakdown;
  evidence: VersionEvidence[];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function compareNumericVersions(left?: number[], right?: number[]): number | undefined {
  if (!left || !right) return undefined;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function orderVersionPair(
  left: RawFileMetadata,
  right: RawFileMetadata,
): { source: RawFileMetadata; target: RawFileMetadata } {
  const numericOrder = compareNumericVersions(
    left.analysis.numericVersion,
    right.analysis.numericVersion,
  );
  if (numericOrder !== undefined && numericOrder !== 0) {
    return numericOrder < 0 ? { source: left, target: right } : { source: right, target: left };
  }

  const timeOrder = Date.parse(left.modifiedAt) - Date.parse(right.modifiedAt);
  if (timeOrder !== 0) return timeOrder < 0 ? { source: left, target: right } : { source: right, target: left };
  return left.id < right.id ? { source: left, target: right } : { source: right, target: left };
}

export function timeOrderScore(source: RawFileMetadata, target: RawFileMetadata): number {
  const differenceMinutes =
    (Date.parse(target.modifiedAt) - Date.parse(source.modifiedAt)) / (60 * 1000);
  if (differenceMinutes < 0) return 0.1;
  if (differenceMinutes <= 10) return 0.65;
  if (differenceMinutes <= 24 * 60) return 1;
  if (differenceMinutes <= 7 * 24 * 60) return 0.9;
  if (differenceMinutes <= 30 * 24 * 60) return 0.75;
  if (differenceMinutes <= 90 * 24 * 60) return 0.55;
  return 0.35;
}

export function sizeContinuityScore(sourceSize: number, targetSize: number): number {
  const maximum = Math.max(sourceSize, targetSize);
  if (maximum === 0) return 1;
  const ratio = Math.abs(targetSize - sourceSize) / maximum;
  if (ratio <= 0.05) return 1;
  if (ratio <= 0.2) return 0.9;
  if (ratio <= 0.5) return 0.7;
  if (ratio <= 0.8) return 0.45;
  return 0.2;
}

function directoryParts(path: string): string[] {
  return path.replaceAll('\\', '/').split('/').filter(Boolean);
}

export function directoryRelationScore(
  sourceDirectory: string,
  targetDirectory: string,
): number {
  const source = directoryParts(sourceDirectory);
  const target = directoryParts(targetDirectory);
  if (source.join('/') === target.join('/')) return 1;
  const sourcePath = source.join('/');
  const targetPath = target.join('/');
  if (sourcePath.startsWith(`${targetPath}/`) || targetPath.startsWith(`${sourcePath}/`)) return 0.85;
  if (source.slice(0, -1).join('/') === target.slice(0, -1).join('/')) return 0.7;
  return 0.35;
}

const CATEGORY_RANK: Record<string, number> = {
  draft: 1,
  revision: 2,
  new: 3,
  final: 4,
  submitted: 5,
};

function strongestCategory(file: RawFileMetadata): number | undefined {
  const ranks = file.analysis.versionTokens
    .map((token) => CATEGORY_RANK[token.category])
    .filter((rank) => rank !== undefined);
  return ranks.length > 0 ? Math.max(...ranks) : undefined;
}

export function versionProgressionScore(
  source: RawFileMetadata,
  target: RawFileMetadata,
): number {
  const numericOrder = compareNumericVersions(
    source.analysis.numericVersion,
    target.analysis.numericVersion,
  );
  if (numericOrder !== undefined) {
    if (numericOrder < 0) {
      const length = Math.max(
        source.analysis.numericVersion?.length ?? 0,
        target.analysis.numericVersion?.length ?? 0,
      );
      for (let index = 0; index < length; index += 1) {
        const difference =
          (target.analysis.numericVersion?.[index] ?? 0) -
          (source.analysis.numericVersion?.[index] ?? 0);
        if (difference > 0) return difference === 1 ? (index === 0 ? 0.95 : 1) : 0.78;
      }
      return 0.9;
    }
    if (numericOrder === 0) return 0.7;
    return 0.15;
  }

  const sourceRank = strongestCategory(source);
  const targetRank = strongestCategory(target);
  if (sourceRank === undefined && targetRank === undefined) return 0.65;
  if (sourceRank === undefined || targetRank === undefined) return 0.7;
  if (sourceRank < targetRank) return 0.95;
  if (sourceRank === targetRank) return 0.7;
  return 0.2;
}

function relationForScore(score: number): Exclude<VersionRelation, 'possible_branch'> | undefined {
  if (score >= 0.78) return 'likely_successor';
  if (score >= 0.64) return 'possible_successor';
  if (score >= 0.52) return 'uncertain';
  return undefined;
}

export function scoreParentCandidate(
  source: RawFileMetadata,
  target: RawFileMetadata,
): ScoredParentCandidate | undefined {
  const nameSimilarity = calculateFilenameSimilarity(source.analysis, target.analysis).score;
  const breakdown: VersionEdgeScoreBreakdown = {
    nameSimilarity,
    timeOrderScore: timeOrderScore(source, target),
    sizeContinuityScore: sizeContinuityScore(source.size, target.size),
    directoryRelationScore: directoryRelationScore(
      source.parentDirectory,
      target.parentDirectory,
    ),
    versionProgressionScore: versionProgressionScore(source, target),
  };
  const confidence = clamp(
    0.38 * breakdown.nameSimilarity +
      0.18 * breakdown.timeOrderScore +
      0.14 * breakdown.sizeContinuityScore +
      0.12 * breakdown.directoryRelationScore +
      0.18 * breakdown.versionProgressionScore,
  );
  const relation = relationForScore(confidence);
  if (!relation) return undefined;

  const timeConflict = breakdown.timeOrderScore === 0.1;
  const versionConflict = breakdown.versionProgressionScore <= 0.2;
  const evidence: VersionEvidence[] = [
    {
      type: 'name_similarity',
      description: 'Weighted filename similarity inside the same family.',
      value: breakdown.nameSimilarity,
      impact: breakdown.nameSimilarity >= 0.78 ? 'positive' : 'neutral',
    },
    {
      type: 'time_order',
      description: timeConflict
        ? 'Filename version progression conflicts with modification time order.'
        : 'Modification times support or do not contradict this direction.',
      value: breakdown.timeOrderScore,
      impact: timeConflict ? 'negative' : 'positive',
    },
    {
      type: 'size_continuity',
      description: 'File-size continuity is weak supporting evidence.',
      value: breakdown.sizeContinuityScore,
      impact: breakdown.sizeContinuityScore >= 0.7 ? 'positive' : 'neutral',
    },
    {
      type: 'directory_relation',
      description: 'Directory proximity for the proposed predecessor and successor.',
      value: breakdown.directoryRelationScore,
      impact: breakdown.directoryRelationScore >= 0.7 ? 'positive' : 'neutral',
    },
    {
      type: versionConflict ? 'conflict' : 'version_marker',
      description: versionConflict
        ? 'Version markers appear to move backward.'
        : 'Version markers support or do not contradict this direction.',
      value: breakdown.versionProgressionScore,
      impact: versionConflict ? 'negative' : 'positive',
    },
  ];

  return {
    sourceFileId: source.id,
    targetFileId: target.id,
    confidence,
    relation,
    scoreBreakdown: breakdown,
    evidence,
  };
}
