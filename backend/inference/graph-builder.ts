import type { FileFamily } from '../contracts/family-clustering';
import type { RawFileMetadata } from '../contracts/scan';
import type {
  ParentEdgeRole,
  SerializedVersionGraph,
  VersionEdge,
  VersionGraphNode,
} from '../contracts/version-graph';
import {
  orderVersionPair,
  scoreParentCandidate,
  type ScoredParentCandidate,
} from './edge-scorer';

function edgeId(sourceFileId: string, targetFileId: string): string {
  return `edge:${sourceFileId}:${targetFileId}`;
}

export function wouldCreateCycle(
  edges: Array<Pick<VersionEdge, 'sourceFileId' | 'targetFileId'>>,
  sourceFileId: string,
  targetFileId: string,
): boolean {
  if (sourceFileId === targetFileId) return true;
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = outgoing.get(edge.sourceFileId) ?? [];
    targets.push(edge.targetFileId);
    outgoing.set(edge.sourceFileId, targets);
  }
  const pending = [targetFileId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    if (current === sourceFileId) return true;
    visited.add(current);
    pending.push(...(outgoing.get(current) ?? []));
  }
  return false;
}

function candidateParents(files: RawFileMetadata[]): Map<string, ScoredParentCandidate[]> {
  const candidates = new Map<string, ScoredParentCandidate[]>();
  for (let leftIndex = 0; leftIndex < files.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < files.length; rightIndex += 1) {
      const { source, target } = orderVersionPair(files[leftIndex], files[rightIndex]);
      const scored = scoreParentCandidate(source, target);
      if (!scored) continue;
      const targetCandidates = candidates.get(target.id) ?? [];
      targetCandidates.push(scored);
      candidates.set(target.id, targetCandidates);
    }
  }
  for (const targetCandidates of candidates.values()) {
    targetCandidates.sort(
      (left, right) =>
        right.confidence - left.confidence || left.sourceFileId.localeCompare(right.sourceFileId),
    );
  }
  return candidates;
}

function makeEdge(
  familyId: string,
  candidate: ScoredParentCandidate,
  role: ParentEdgeRole,
): VersionEdge {
  return {
    id: edgeId(candidate.sourceFileId, candidate.targetFileId),
    familyId,
    sourceFileId: candidate.sourceFileId,
    targetFileId: candidate.targetFileId,
    role,
    relation: candidate.relation,
    confidence: candidate.confidence,
    scoreBreakdown: candidate.scoreBreakdown,
    evidence: candidate.evidence,
    overriddenByUser: false,
  };
}

function buildFamilyEdges(family: FileFamily, files: RawFileMetadata[]): VersionEdge[] {
  const candidates = candidateParents(files);
  const edges: VersionEdge[] = [];
  const targets = [...candidates.keys()].sort((left, right) => left.localeCompare(right));
  for (const targetId of targets) {
    let accepted = 0;
    for (const candidate of candidates.get(targetId) ?? []) {
      if (accepted >= 3) break;
      if (wouldCreateCycle(edges, candidate.sourceFileId, candidate.targetFileId)) continue;
      edges.push(makeEdge(family.id, candidate, accepted === 0 ? 'main' : 'alternate'));
      accepted += 1;
    }
  }
  return edges;
}

function markBranches(edges: VersionEdge[]): { edges: VersionEdge[]; branchPointFileIds: string[] } {
  const mainOutgoing = new Map<string, VersionEdge[]>();
  for (const edge of edges) {
    if (edge.role !== 'main' || edge.confidence < 0.64) continue;
    const outgoing = mainOutgoing.get(edge.sourceFileId) ?? [];
    outgoing.push(edge);
    mainOutgoing.set(edge.sourceFileId, outgoing);
  }
  const branchPoints = new Set(
    [...mainOutgoing.entries()].filter(([, outgoing]) => outgoing.length > 1).map(([fileId]) => fileId),
  );
  return {
    edges: edges.map((edge) =>
      branchPoints.has(edge.sourceFileId) && edge.role === 'main'
        ? { ...edge, relation: 'possible_branch' }
        : edge,
    ),
    branchPointFileIds: [...branchPoints].sort(),
  };
}

function serializeNodes(
  families: FileFamily[],
  files: RawFileMetadata[],
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
        level.set(
          edge.targetFileId,
          Math.max(level.get(edge.targetFileId) ?? 0, (level.get(edge.sourceFileId) ?? 0) + 1),
        );
      }
    }
    const byLevel = new Map<number, string[]>();
    for (const fileId of family.fileIds) {
      const fileLevel = level.get(fileId) ?? 0;
      const ids = byLevel.get(fileLevel) ?? [];
      ids.push(fileId);
      byLevel.set(fileLevel, ids);
    }
    const familyHeight = Math.max(...[...byLevel.values()].map((ids) => ids.length), 1) * 110;
    for (const [fileLevel, fileIds] of byLevel) {
      fileIds.sort();
      fileIds.forEach((fileId, index) => {
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

export function buildVersionGraph(
  files: RawFileMetadata[],
  families: FileFamily[],
): SerializedVersionGraph {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const rawEdges = families.flatMap((family) => {
    const familyFiles = family.fileIds
      .map((fileId) => fileById.get(fileId))
      .filter((file) => file !== undefined);
    return buildFamilyEdges(family, familyFiles);
  });
  const { edges, branchPointFileIds } = markBranches(rawEdges);
  const mainTargets = new Set(
    edges.filter((edge) => edge.role === 'main').map((edge) => edge.targetFileId),
  );
  const mainSources = new Set(
    edges.filter((edge) => edge.role === 'main').map((edge) => edge.sourceFileId),
  );
  return {
    schemaVersion: '1.0',
    nodes: serializeNodes(families, files, edges),
    edges,
    rootFileIds: files.map((file) => file.id).filter((fileId) => !mainTargets.has(fileId)).sort(),
    leafFileIds: files.map((file) => file.id).filter((fileId) => !mainSources.has(fileId)).sort(),
    branchPointFileIds,
  };
}
