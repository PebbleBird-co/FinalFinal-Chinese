import type { FamilyClusteringResult, FileFamily } from '../contracts/family-clustering';
import type { MainVersionCandidate, MainVersionRanking } from '../contracts/main-version';
import type { UserOverride } from '../contracts/override';
import type { RawFileMetadata, ScanResult } from '../contracts/scan';
import type { SerializedVersionGraph, VersionEdge, VersionGraphNode } from '../contracts/version-graph';
import { wouldCreateCycle } from '../inference/graph-builder';
import { rankMainVersionCandidates } from '../ranking/main-version-ranker';
import { analyzeTimelineAndRisks } from '../timeline/timeline-analyzer';
import { buildVersionGraph } from '../inference/graph-builder';

const OVERRIDE_TYPES = new Set<UserOverride['type']>([
  'set_main_version',
  'mark_abandoned',
  'mark_as_copy',
  'set_parent',
  'remove_edge',
  'merge_families',
  'split_family',
]);

export class OverrideValidationError extends Error {}

export function validateOverrides(overrides: UserOverride[]): void {
  if (!Array.isArray(overrides) || overrides.length > 10_000) {
    throw new OverrideValidationError('纠正记录格式无效或数量过多。');
  }
  for (const item of overrides) {
    if (!item || typeof item !== 'object' || !OVERRIDE_TYPES.has(item.type)) {
      throw new OverrideValidationError('存在不支持的纠正类型。');
    }
    if (typeof item.id !== 'string' || item.id.length < 1 || item.id.length > 120) {
      throw new OverrideValidationError('纠正记录标识无效。');
    }
    if (!Array.isArray(item.targetIds) || item.targetIds.some((id) => typeof id !== 'string')) {
      throw new OverrideValidationError('纠正目标格式无效。');
    }
    if (typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt))) {
      throw new OverrideValidationError('纠正时间格式无效。');
    }
  }
}

function familyForFile(families: FileFamily[], fileId: string): FileFamily | undefined {
  return families.find((family) => family.fileIds.includes(fileId));
}

function applyFamilyOverrides(baseFamilies: FileFamily[], overrides: UserOverride[]): FileFamily[] {
  let families = structuredClone(baseFamilies);
  for (const item of overrides) {
    if (item.type === 'split_family') {
      const [fileId] = item.targetIds;
      const source = fileId ? familyForFile(families, fileId) : undefined;
      if (!source || source.fileIds.length <= 1) continue;
      source.fileIds = source.fileIds.filter((id) => id !== fileId);
      const splitId = `family:user:${encodeURIComponent(fileId)}`;
      families = families.filter((family) => family.id !== splitId);
      families.push({
        id: splitId,
        displayName: source.displayName,
        coreName: source.coreName,
        fileIds: [fileId],
        confidence: 1,
        evidence: [
          {
            type: 'conflict',
            description: '用户将此文件从原文件家族中拆出。',
            impact: 'neutral',
          },
        ],
      });
    }

    if (item.type === 'merge_families') {
      const [sourceId, targetId] = item.targetIds;
      if (!sourceId || !targetId || sourceId === targetId) continue;
      const source = families.find((family) => family.id === sourceId);
      const target = families.find((family) => family.id === targetId);
      if (!source || !target) continue;
      target.fileIds = [...new Set([...target.fileIds, ...source.fileIds])].sort();
      target.confidence = 1;
      target.evidence = [
        ...target.evidence,
        { type: 'conflict', description: '用户确认两个文件家族应合并。', impact: 'neutral' },
      ];
      families = families.filter((family) => family.id !== sourceId);
    }
  }
  return families.filter((family) => family.fileIds.length > 0);
}

function clusteringWithFamilies(
  base: FamilyClusteringResult,
  families: FileFamily[],
): FamilyClusteringResult {
  const familyByFile = new Map<string, string>();
  for (const family of families) for (const fileId of family.fileIds) familyByFile.set(fileId, family.id);
  return {
    ...structuredClone(base),
    families,
    strongRelations: base.strongRelations.filter(
      (relation) => familyByFile.get(relation.leftFileId) === familyByFile.get(relation.rightFileId),
    ),
  };
}

function forcedEdge(
  familyId: string,
  sourceFileId: string,
  targetFileId: string,
  overrideId: string,
): VersionEdge {
  return {
    id: `edge:user:${overrideId}`,
    familyId,
    sourceFileId,
    targetFileId,
    role: 'main',
    relation: 'likely_successor',
    confidence: 1,
    scoreBreakdown: {
      nameSimilarity: 0,
      timeOrderScore: 0,
      sizeContinuityScore: 0,
      directoryRelationScore: 0,
      versionProgressionScore: 0,
    },
    evidence: [
      {
        type: 'conflict',
        description: '该父版本关系由用户确认，优先于自动推断。',
        value: overrideId,
        impact: 'positive',
      },
    ],
    overriddenByUser: true,
  };
}

function layoutNodes(
  files: RawFileMetadata[],
  families: FileFamily[],
  edges: VersionEdge[],
): VersionGraphNode[] {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const nodes: VersionGraphNode[] = [];
  let familyOffset = 0;
  for (const family of families) {
    const mainEdges = edges.filter((edge) => edge.familyId === family.id && edge.role === 'main');
    const level = new Map(family.fileIds.map((fileId) => [fileId, 0]));
    for (let pass = 0; pass < family.fileIds.length; pass += 1) {
      for (const edge of mainEdges) {
        level.set(edge.targetFileId, Math.max(level.get(edge.targetFileId) ?? 0, (level.get(edge.sourceFileId) ?? 0) + 1));
      }
    }
    const byLevel = new Map<number, string[]>();
    for (const fileId of family.fileIds) {
      const fileLevel = level.get(fileId) ?? 0;
      byLevel.set(fileLevel, [...(byLevel.get(fileLevel) ?? []), fileId]);
    }
    const familyHeight = Math.max(...[...byLevel.values()].map((ids) => ids.length), 1) * 110;
    for (const [fileLevel, fileIds] of byLevel) {
      fileIds.sort().forEach((fileId, index) => {
        const file = fileById.get(fileId);
        if (!file) return;
        nodes.push({
          id: `node:${fileId}`,
          fileId,
          familyId: family.id,
          label: file.name,
          modifiedAt: file.modifiedAt,
          position: { x: fileLevel * 280, y: familyOffset + index * 110 },
          incomingMainEdgeCount: mainEdges.filter((edge) => edge.targetFileId === fileId).length,
          outgoingMainEdgeCount: mainEdges.filter((edge) => edge.sourceFileId === fileId).length,
        });
      });
    }
    familyOffset += familyHeight + 100;
  }
  return nodes;
}

function finalizeGraph(
  files: RawFileMetadata[],
  families: FileFamily[],
  edges: VersionEdge[],
): SerializedVersionGraph {
  const mainEdges = edges.filter((edge) => edge.role === 'main');
  const mainTargets = new Set(mainEdges.map((edge) => edge.targetFileId));
  const mainSources = new Set(mainEdges.map((edge) => edge.sourceFileId));
  const branchPointFileIds = [...new Set(
    files
      .filter((file) => mainEdges.filter((edge) => edge.sourceFileId === file.id).length > 1)
      .map((file) => file.id),
  )].sort();
  return {
    schemaVersion: '1.0',
    nodes: layoutNodes(files, families, edges),
    edges: edges.map((edge) =>
      branchPointFileIds.includes(edge.sourceFileId) && edge.role === 'main'
        ? { ...edge, relation: 'possible_branch' }
        : edge,
    ),
    rootFileIds: files.map((file) => file.id).filter((id) => !mainTargets.has(id)).sort(),
    leafFileIds: files.map((file) => file.id).filter((id) => !mainSources.has(id)).sort(),
    branchPointFileIds,
  };
}

function applyGraphOverrides(
  graph: SerializedVersionGraph,
  files: RawFileMetadata[],
  families: FileFamily[],
  overrides: UserOverride[],
): SerializedVersionGraph {
  let edges = structuredClone(graph.edges);
  const fileIds = new Set(files.map((file) => file.id));
  for (const item of overrides) {
    if (item.type === 'remove_edge') {
      const [edgeId] = item.targetIds;
      edges = edges.filter((edge) => edge.id !== edgeId);
    }
    if (item.type === 'set_parent') {
      const [sourceFileId, targetFileId] = item.targetIds;
      if (!sourceFileId || !targetFileId || !fileIds.has(sourceFileId) || !fileIds.has(targetFileId)) {
        throw new OverrideValidationError('父版本纠正引用了不存在的文件。');
      }
      const family = familyForFile(families, targetFileId);
      if (!family || !family.fileIds.includes(sourceFileId)) {
        throw new OverrideValidationError('父版本与后继版本必须位于同一文件家族。');
      }
      edges = edges.filter(
        (edge) => !(edge.targetFileId === targetFileId && edge.role === 'main') && edge.id !== `edge:user:${item.id}`,
      );
      if (wouldCreateCycle(edges, sourceFileId, targetFileId)) {
        throw new OverrideValidationError('该父版本关系会形成循环，无法应用。');
      }
      edges.push(forcedEdge(family.id, sourceFileId, targetFileId, item.id));
    }
  }
  const validFamilyByFile = new Map<string, string>();
  for (const family of families) for (const fileId of family.fileIds) validFamilyByFile.set(fileId, family.id);
  edges = edges.filter(
    (edge) => validFamilyByFile.get(edge.sourceFileId) === validFamilyByFile.get(edge.targetFileId),
  ).map((edge) => ({ ...edge, familyId: validFamilyByFile.get(edge.sourceFileId) ?? edge.familyId }));
  return finalizeGraph(files, families, edges);
}

function confirmedCandidate(fileId: string, familyId: string): MainVersionCandidate {
  return {
    fileId,
    familyId,
    score: 1,
    confidence: 1,
    confidenceText: '用户已确认',
    rank: 1,
    recommended: true,
    scoreBreakdown: {
      recencyScore: 0,
      graphLeafScore: 0,
      versionMarkerScore: 0,
      directoryIntentScore: 0,
      branchCentralityScore: 0,
      sizePlausibilityScore: 0,
      userConfirmationScore: 1,
    },
    penalties: [],
    evidence: [
      {
        type: 'userConfirmationScore',
        description: '用户明确将此文件设为主版本；该纠正优先于自动排名。',
        value: 1,
        impact: 'positive',
      },
    ],
    warnings: ['这是用户对分析报告的纠正，不会修改原始文件。'],
  };
}

function applyCandidateOverrides(
  automatic: MainVersionRanking,
  families: FileFamily[],
  overrides: UserOverride[],
): MainVersionRanking {
  const lastDisposition = new Map<string, { type: 'mark_abandoned' | 'mark_as_copy'; index: number }>();
  const mainByFamily = new Map<string, { fileId: string; index: number }>();
  overrides.forEach((item, index) => {
    if (item.type === 'mark_abandoned' || item.type === 'mark_as_copy') {
      const [fileId] = item.targetIds;
      if (fileId) lastDisposition.set(fileId, { type: item.type, index });
    }
    if (item.type === 'set_main_version') {
      const [fileId] = item.targetIds;
      const family = fileId ? familyForFile(families, fileId) : undefined;
      if (fileId && family) mainByFamily.set(family.id, { fileId, index });
    }
  });

  const candidates = families.flatMap((family) => {
    const confirmed = mainByFamily.get(family.id);
    const eligible = automatic.candidates.filter((candidate) => {
      if (candidate.familyId !== family.id) return false;
      const disposition = lastDisposition.get(candidate.fileId);
      return !disposition || (confirmed?.fileId === candidate.fileId && confirmed.index > disposition.index);
    });
    if (confirmed) {
      const disposition = lastDisposition.get(confirmed.fileId);
      if (!disposition || confirmed.index > disposition.index) {
        const selected = confirmedCandidate(confirmed.fileId, family.id);
        return [selected, ...eligible.filter((candidate) => candidate.fileId !== confirmed.fileId)]
          .slice(0, 3)
          .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
      }
    }
    return eligible.slice(0, 3).map((candidate, index) => ({ ...candidate, rank: index + 1 }));
  });
  return { ...automatic, candidates };
}

export function applyOverrides(baseResult: ScanResult, overrides: UserOverride[]): ScanResult {
  validateOverrides(overrides);
  const fileIds = new Set(baseResult.files.map((file) => file.id));
  for (const item of overrides) {
    if (['set_main_version', 'mark_abandoned', 'mark_as_copy', 'split_family'].includes(item.type)) {
      const [fileId] = item.targetIds;
      if (!fileId || !fileIds.has(fileId)) throw new OverrideValidationError('纠正引用了不存在的文件。');
    }
  }

  const families = applyFamilyOverrides(baseResult.clustering.families, overrides);
  const clustering = clusteringWithFamilies(baseResult.clustering, families);
  const automaticGraph = buildVersionGraph(baseResult.files, families);
  const versionGraph = applyGraphOverrides(automaticGraph, baseResult.files, families, overrides);
  const timeline = analyzeTimelineAndRisks(baseResult.files, clustering, versionGraph);
  const automaticRanking = rankMainVersionCandidates(baseResult.files, families, versionGraph, timeline);
  return {
    ...structuredClone(baseResult),
    clustering,
    versionGraph,
    timeline,
    mainVersions: applyCandidateOverrides(automaticRanking, families, overrides),
  };
}
