import type { FamilyClusteringResult, FileFamily } from '../contracts/family-clustering';
import type { RawFileMetadata } from '../contracts/scan';
import type {
  ProjectEvent,
  ProjectRisk,
  RiskSeverity,
  TimelineEvidence,
} from '../contracts/timeline-risk';
import type { SerializedVersionGraph } from '../contracts/version-graph';

const DAY_MS = 24 * 60 * 60 * 1000;

function risk(
  type: ProjectRisk['type'],
  key: string,
  values: Omit<ProjectRisk, 'id' | 'type'>,
): ProjectRisk {
  return { id: `risk:${type}:${key}`, type, ...values };
}

function finalOrSubmitted(file: RawFileMetadata): boolean {
  return file.analysis.versionTokens.some((token) => token.category === 'final' || token.category === 'submitted');
}

function severityForCount(count: number): RiskSeverity {
  return count >= 3 ? 'high' : 'medium';
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function detectMultipleFinalVersions(
  files: RawFileMetadata[],
  families: FileFamily[],
  graph: SerializedVersionGraph,
): ProjectRisk[] {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const latestTime = Math.max(...files.map((file) => Date.parse(file.modifiedAt)), 0);
  const leafIds = new Set(graph.leafFileIds);
  return families.flatMap((family) => {
    const candidates = family.fileIds
      .map((id) => fileById.get(id))
      .filter((file): file is RawFileMetadata => file !== undefined && finalOrSubmitted(file))
      .filter((file) => leafIds.has(file.id) || latestTime - Date.parse(file.modifiedAt) <= 7 * DAY_MS);
    if (candidates.length < 2) return [];
    return [
      risk('multiple_final_versions', family.id, {
        severity: severityForCount(candidates.length),
        title: '存在多个最终版候选',
        description: `同一文件家族中有 ${candidates.length} 个近期或叶节点文件带有最终/提交标记。`,
        confidence: Math.min(0.94, 0.72 + candidates.length * 0.06),
        relatedFileIds: candidates.map((file) => file.id),
        relatedFamilyIds: [family.id],
        evidence: [
          { type: 'version_marker', description: '多个最终或提交标记同时处于叶节点或近期活跃范围。', value: candidates.length, impact: 'negative' },
        ],
        recommendation: '逐一确认交付对象、修改时间与所在目录，不要仅依据“最终”字样选择文件。',
      }),
    ];
  });
}

export function detectRevivedBranchRisks(events: ProjectEvent[]): ProjectRisk[] {
  return events
    .filter((item) => item.type === 'old_branch_revived')
    .map((item) =>
      risk('revived_old_branch', item.id, {
        severity: 'medium',
        title: '旧分支可能恢复活动',
        description: item.description,
        confidence: item.confidence,
        relatedFileIds: item.relatedFileIds,
        relatedFamilyIds: item.relatedFamilyIds,
        evidence: item.evidence,
        recommendation: '确认恢复修改是否有意为之，并检查它是否应继续参与当前版本判断。',
      }),
    );
}

export function detectShadowCopies(
  files: RawFileMetadata[],
  clustering: FamilyClusteringResult,
  graph: SerializedVersionGraph,
): ProjectRisk[] {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const latestTime = Math.max(...files.map((file) => Date.parse(file.modifiedAt)), 0);
  const graphPairs = new Set(
    graph.edges.map((edge) => `${edge.sourceFileId}\u0000${edge.targetFileId}`),
  );
  const relations = [...clustering.strongRelations, ...clustering.weakRelations];
  return relations.flatMap((relation) => {
    if (relation.similarity <= 0.82) return [];
    const left = fileById.get(relation.leftFileId);
    const right = fileById.get(relation.rightFileId);
    if (!left || !right || left.parentDirectory === right.parentDirectory) return [];
    if (latestTime - Date.parse(left.modifiedAt) > 30 * DAY_MS || latestTime - Date.parse(right.modifiedAt) > 30 * DAY_MS) return [];
    if (Math.abs(Date.parse(left.modifiedAt) - Date.parse(right.modifiedAt)) > 72 * 60 * 60 * 1000) return [];
    if (
      graphPairs.has(`${left.id}\u0000${right.id}`) ||
      graphPairs.has(`${right.id}\u0000${left.id}`)
    ) return [];
    return [
      risk('cross_directory_shadow_copy', relation.id, {
        severity: 'medium',
        title: '可能存在跨目录影子副本',
        description: '两个近期文件名称高度相似、时间接近且位于不同目录，但版本图中没有可信继承边。',
        confidence: Math.min(0.9, relation.similarity),
        relatedFileIds: [left.id, right.id],
        relatedFamilyIds: unique(
          clustering.families
            .filter((family) => family.fileIds.includes(left.id) || family.fileIds.includes(right.id))
            .map((family) => family.id),
        ),
        evidence: [
          { type: 'name_similarity', description: '跨目录文件名相似度高于 0.82。', value: relation.similarity, impact: 'negative' },
          { type: 'time_range', description: '两个文件的修改时间相差不超过 72 小时。', impact: 'neutral' },
        ],
        recommendation: '确认两个目录的用途，并人工判断其中一个是否只是同步或交付副本。',
      }),
    ];
  });
}

export function detectBranchExplosion(
  families: FileFamily[],
  graph: SerializedVersionGraph,
): ProjectRisk[] {
  return families.flatMap((family) => {
    const familyLeafIds = graph.leafFileIds.filter((id) => family.fileIds.includes(id));
    const directSuccessors = family.fileIds.map((fileId) =>
      graph.edges.filter((edge) => edge.role === 'main' && edge.sourceFileId === fileId).length,
    );
    const maximumSuccessors = Math.max(...directSuccessors, 0);
    if (familyLeafIds.length < 4 && maximumSuccessors < 3) return [];
    const evidence: TimelineEvidence[] = [
      { type: 'graph_position', description: '家族叶节点或单节点直接后继数量超过安全阈值。', value: Math.max(familyLeafIds.length, maximumSuccessors), impact: 'negative' },
    ];
    return [
      risk('branch_explosion', family.id, {
        severity: 'high',
        title: '版本分支数量较多',
        description: `该家族当前有 ${familyLeafIds.length} 个叶节点，最大直接后继数为 ${maximumSuccessors}。`,
        confidence: 0.88,
        relatedFileIds: family.fileIds,
        relatedFamilyIds: [family.id],
        evidence,
        recommendation: '人工确认仍在使用的分支，并记录每个分支的用途和负责人。',
      }),
    ];
  });
}

export function detectTimelineNameConflicts(
  graph: SerializedVersionGraph,
  files: RawFileMetadata[] = [],
  families: FileFamily[] = [],
): ProjectRisk[] {
  const conflicting = graph.edges.filter(
    (edge) =>
      edge.scoreBreakdown.timeOrderScore === 0.1 ||
      edge.scoreBreakdown.versionProgressionScore <= 0.2,
  );
  const byFamily = new Map<
    string,
    { fileIds: Set<string>; evidence: TimelineEvidence[] }
  >();
  for (const edge of conflicting) {
    const entry = byFamily.get(edge.familyId) ?? { fileIds: new Set<string>(), evidence: [] };
    entry.fileIds.add(edge.sourceFileId);
    entry.fileIds.add(edge.targetFileId);
    entry.evidence.push(
      ...edge.evidence
        .filter((item) => item.impact === 'negative')
        .map((item) => ({
          type: 'conflict' as const,
          description: item.description,
          value: item.value,
          impact: 'negative' as const,
        })),
    );
    byFamily.set(edge.familyId, entry);
  }
  const fileById = new Map(files.map((file) => [file.id, file]));
  for (const family of families) {
    const familyFiles = family.fileIds
      .map((id) => fileById.get(id))
      .filter((file): file is RawFileMetadata => file !== undefined)
      .sort((left, right) => left.modifiedAt.localeCompare(right.modifiedAt));
    if (familyFiles.length === 0) continue;
    const entry = byFamily.get(family.id) ?? { fileIds: new Set<string>(), evidence: [] };
    const newest = familyFiles.at(-1);
    if (newest?.analysis.versionTokens.some((token) => token.category === 'backup')) {
      entry.fileIds.add(newest.id);
      entry.evidence.push({
        type: 'conflict',
        description: '家族中最新修改的文件带有旧版、备份或归档标记。',
        value: newest.name,
        impact: 'negative',
      });
    }
    const submittedIndex = familyFiles.findIndex((file) =>
      file.analysis.versionTokens.some((token) => token.category === 'submitted'),
    );
    if (submittedIndex >= 0) {
      const laterRevisions = familyFiles.slice(submittedIndex + 1).filter((file) =>
        file.analysis.versionTokens.some((token) =>
          ['draft', 'revision', 'new'].includes(token.category),
        ),
      );
      if (laterRevisions.length > 0) {
        entry.fileIds.add(familyFiles[submittedIndex].id);
        laterRevisions.forEach((file) => entry.fileIds.add(file.id));
        entry.evidence.push({
          type: 'conflict',
          description: '提交标记之后又出现了草稿、修改或新版文件。',
          value: laterRevisions.length,
          impact: 'negative',
        });
      }
    }
    if (entry.evidence.length > 0) byFamily.set(family.id, entry);
  }
  return [...byFamily.entries()].map(([familyId, entry]) =>
    risk('timeline_name_conflict', familyId, {
      severity: entry.evidence.length >= 2 ? 'high' : 'medium',
      title: '时间与版本命名可能冲突',
      description: '版本号或版本词的演进方向与修改时间顺序存在冲突。',
      confidence: Math.min(0.92, 0.7 + entry.evidence.length * 0.08),
      relatedFileIds: [...entry.fileIds].sort(),
      relatedFamilyIds: [familyId],
      evidence: entry.evidence,
      recommendation: '检查文件是否被复制、恢复或手工修改过时间戳，并以业务记录人工确认顺序。',
    }),
  );
}

function looksLikeNewVersion(file: RawFileMetadata): boolean {
  if ((file.analysis.numericVersion?.[0] ?? 0) >= 2) return true;
  return file.analysis.versionTokens.some((token) =>
    ['new', 'revision', 'final', 'submitted'].includes(token.category),
  );
}

export function detectIsolatedNewVersions(
  files: RawFileMetadata[],
  families: FileFamily[],
  graph: SerializedVersionGraph,
): ProjectRisk[] {
  const incoming = new Set(
    graph.edges.filter((edge) => edge.role === 'main').map((edge) => edge.targetFileId),
  );
  const familyByFile = new Map<string, FileFamily>();
  for (const family of families) for (const fileId of family.fileIds) familyByFile.set(fileId, family);
  return files.flatMap((file) => {
    if (!looksLikeNewVersion(file) || incoming.has(file.id)) return [];
    const family = familyByFile.get(file.id);
    if (family && family.fileIds.length > 1) return [];
    return [
      risk('isolated_new_version', file.id, {
        severity: 'medium',
        title: '新版文件缺少可信父节点',
        description: '文件名包含新版、修改、最终或 v2+ 信号，但没有找到可信的前序文件。',
        confidence: 0.68,
        relatedFileIds: [file.id],
        relatedFamilyIds: family ? [family.id] : [],
        evidence: [
          { type: 'version_marker', description: '文件名包含较新的版本标记。', value: file.analysis.versionTokens.map((token) => token.raw).join(', '), impact: 'negative' },
          { type: 'graph_position', description: '版本图中没有可信主父边。', impact: 'negative' },
        ],
        recommendation: '搜索是否存在大幅改名或位于其他目录的前序版本，并人工确认来源。',
      }),
    ];
  });
}

export function detectProjectRisks(
  files: RawFileMetadata[],
  clustering: FamilyClusteringResult,
  graph: SerializedVersionGraph,
  events: ProjectEvent[],
): ProjectRisk[] {
  return [
    ...detectMultipleFinalVersions(files, clustering.families, graph),
    ...detectRevivedBranchRisks(events),
    ...detectShadowCopies(files, clustering, graph),
    ...detectBranchExplosion(clustering.families, graph),
    ...detectTimelineNameConflicts(graph, files, clustering.families),
    ...detectIsolatedNewVersions(files, clustering.families, graph),
  ].sort((left, right) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[left.severity] - order[right.severity] || right.confidence - left.confidence;
  });
}
