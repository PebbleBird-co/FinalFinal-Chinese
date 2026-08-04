import { dirname, sep } from 'node:path';
import { calculateFilenameSimilarity } from '../analysis/filename-similarity';
import type {
  FamilyClusteringResult,
  FamilyEvidence,
  FamilyRelation,
  FileFamily,
} from '../contracts/family-clustering';
import { FAMILY_THRESHOLDS } from '../contracts/family-clustering';
import type { RawFileMetadata } from '../contracts/scan';
import { generateCandidatePairs } from './candidate-generator';
import { UnionFind } from './union-find';

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function pathDistance(left: string, right: string): number {
  const leftParts = dirname(left).split(sep).filter(Boolean);
  const rightParts = dirname(right).split(sep).filter(Boolean);
  let shared = 0;
  while (shared < leftParts.length && leftParts[shared] === rightParts[shared]) shared += 1;
  return leftParts.length + rightParts.length - 2 * shared;
}

function sizeRatio(left: number, right: number): number {
  if (left === 0 && right === 0) return 1;
  if (left === 0 || right === 0) return Number.POSITIVE_INFINITY;
  return Math.max(left, right) / Math.min(left, right);
}

function relationId(leftId: string, rightId: string): string {
  return `relation:${leftId < rightId ? `${leftId}:${rightId}` : `${rightId}:${leftId}`}`;
}

export function scoreFamilyCandidate(
  left: RawFileMetadata,
  right: RawFileMetadata,
): Omit<FamilyRelation, 'strength'> {
  const base = calculateFilenameSimilarity(left.analysis, right.analysis);
  const evidence: FamilyEvidence[] = [
    {
      type: 'name_similarity',
      description: 'Combined filename similarity before clustering penalties.',
      value: base.score,
      impact: 'positive',
    },
    {
      type: 'extension_compatibility',
      description: 'Compatibility of the two file extensions.',
      value: base.breakdown.extensionCompatibility,
      impact: base.breakdown.extensionCompatibility >= 0.6 ? 'positive' : 'negative',
    },
  ];
  let penalty = 0;
  const ratio = sizeRatio(left.size, right.size);
  if (ratio > 20) {
    penalty += 0.12;
    evidence.push({
      type: 'size_continuity',
      description: 'File sizes differ by more than twenty times.',
      value: Number.isFinite(ratio) ? ratio : 'infinite',
      impact: 'negative',
    });
  } else {
    evidence.push({
      type: 'size_continuity',
      description: 'File sizes remain within the twenty-times continuity limit.',
      value: ratio,
      impact: 'positive',
    });
  }

  if (base.breakdown.extensionCompatibility <= 0.1) {
    penalty += 0.15;
    evidence.push({
      type: 'conflict',
      description: 'The file formats are not known to be compatible.',
      impact: 'negative',
    });
  }

  const distance = pathDistance(left.absolutePath, right.absolutePath);
  const hasVersionSignal =
    left.analysis.versionTokens.length > 0 || right.analysis.versionTokens.length > 0;
  if (distance > 6 && !hasVersionSignal) {
    penalty += 0.08;
    evidence.push({
      type: 'directory_relation',
      description: 'The files are far apart and have no explicit version marker.',
      value: distance,
      impact: 'negative',
    });
  } else {
    evidence.push({
      type: 'directory_relation',
      description: 'Directory distance does not contradict a possible family relation.',
      value: distance,
      impact: 'neutral',
    });
  }

  if (hasVersionSignal) {
    evidence.push({
      type: 'version_marker',
      description: 'At least one filename contains an explicit version marker.',
      impact: 'positive',
    });
  }

  return {
    id: relationId(left.id, right.id),
    leftFileId: left.id,
    rightFileId: right.id,
    similarity: clamp(base.score - penalty),
    baseSimilarity: base.score,
    scoreBreakdown: base.breakdown,
    evidence,
  };
}

function chooseCoreName(files: RawFileMetadata[]): string {
  const counts = new Map<string, number>();
  for (const file of files) {
    if (file.analysis.coreName) {
      counts.set(file.analysis.coreName, (counts.get(file.analysis.coreName) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort(
    ([leftName, leftCount], [rightName, rightCount]) =>
      rightCount - leftCount || leftName.length - rightName.length || leftName.localeCompare(rightName),
  )[0]?.[0] ?? '';
}

function familyFromGroup(
  fileIds: string[],
  fileById: Map<string, RawFileMetadata>,
  strongRelations: FamilyRelation[],
): FileFamily {
  const files = fileIds.map((id) => fileById.get(id)).filter((file) => file !== undefined);
  const coreName = chooseCoreName(files);
  const familyRelations = strongRelations.filter(
    (relation) => fileIds.includes(relation.leftFileId) && fileIds.includes(relation.rightFileId),
  );
  const confidence =
    familyRelations.length === 0
      ? 0
      : familyRelations.reduce((sum, relation) => sum + relation.similarity, 0) /
        familyRelations.length;
  const sortedIds = [...fileIds].sort();
  return {
    id: `family:${sortedIds[0]}`,
    displayName: coreName || files[0]?.analysis.stem || sortedIds[0],
    coreName,
    fileIds: sortedIds,
    confidence,
    evidence: familyRelations.flatMap((relation) => relation.evidence),
  };
}

export function clusterFileFamilies(files: RawFileMetadata[]): FamilyClusteringResult {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const candidates = generateCandidatePairs(files);
  const unionFind = new UnionFind(files.map((file) => file.id));
  const strongRelations: FamilyRelation[] = [];
  const weakRelations: FamilyRelation[] = [];

  for (const candidate of candidates) {
    const left = fileById.get(candidate.leftFileId);
    const right = fileById.get(candidate.rightFileId);
    if (!left || !right) continue;
    const scored = scoreFamilyCandidate(left, right);
    if (scored.similarity >= FAMILY_THRESHOLDS.strong) {
      const relation: FamilyRelation = { ...scored, strength: 'strong' };
      strongRelations.push(relation);
      unionFind.union(left.id, right.id);
    } else if (scored.similarity >= FAMILY_THRESHOLDS.weak) {
      weakRelations.push({ ...scored, strength: 'weak' });
    }
  }

  const families = unionFind
    .groups()
    .map((fileIds) => familyFromGroup(fileIds, fileById, strongRelations))
    .sort((left, right) =>
      right.fileIds.length - left.fileIds.length || left.displayName.localeCompare(right.displayName),
    );
  const crossFamilyWeakRelations = weakRelations.filter(
    (relation) => unionFind.find(relation.leftFileId) !== unionFind.find(relation.rightFileId),
  );

  return {
    families,
    strongRelations,
    weakRelations: crossFamilyWeakRelations,
    candidatePairCount: candidates.length,
    totalPossiblePairCount: (files.length * (files.length - 1)) / 2,
  };
}
