import type { FileFamily } from '../contracts/family-clustering';
import type {
  MainVersionCandidate,
  MainVersionEvidence,
  MainVersionPenalty,
  MainVersionRanking,
  MainVersionScoreBreakdown,
} from '../contracts/main-version';
import type { RawFileMetadata } from '../contracts/scan';
import type { TimelineRiskAnalysis } from '../contracts/timeline-risk';
import type { SerializedVersionGraph } from '../contracts/version-graph';
import { confidencePhrase } from './confidence-language';

const DISCLAIMER =
  '文件名中的“最终”“定稿”或“提交”只作为弱证据，不能证明该文件一定是正式版本。';

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function recencyScores(files: RawFileMetadata[]): Map<string, number> {
  const times = files.map((file) => Date.parse(file.modifiedAt));
  const earliest = Math.min(...times);
  const latest = Math.max(...times);
  const span = latest - earliest;
  return new Map(
    files.map((file) => [file.id, span === 0 ? 1 : (Date.parse(file.modifiedAt) - earliest) / span]),
  );
}

function versionMarkerScore(file: RawFileMetadata): number {
  const categories = new Set(file.analysis.versionTokens.map((token) => token.category));
  if (categories.has('submitted')) return 1;
  if (categories.has('final')) return 0.9;
  if (categories.has('new')) return 0.65;
  if (categories.has('revision') || categories.has('numeric')) return 0.55;
  if (categories.has('draft')) return 0.3;
  return 0.5;
}

function directoryIntentScore(directory: string): number {
  const normalized = directory.normalize('NFKC').toLowerCase();
  if (/(正式|提交|交付|送审|final|delivery|deliverable|release)/u.test(normalized)) return 1;
  if (/(归档|历史|旧版|备份|archive|history|backup|old)/u.test(normalized)) return 0.2;
  return 0.6;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function sizePlausibilityScore(size: number, familyMedian: number): number {
  const maximum = Math.max(size, familyMedian);
  if (maximum === 0) return 1;
  const difference = Math.abs(size - familyMedian) / maximum;
  if (difference <= 0.2) return 1;
  if (difference <= 0.5) return 0.8;
  if (difference <= 0.8) return 0.55;
  return 0.3;
}

function branchCentralityScore(
  fileId: string,
  graph: SerializedVersionGraph,
): number {
  const mainIncoming = graph.edges.filter(
    (edge) => edge.role === 'main' && edge.targetFileId === fileId,
  );
  const mainOutgoing = graph.edges.filter(
    (edge) => edge.role === 'main' && edge.sourceFileId === fileId,
  );
  if (mainOutgoing.length === 0 && mainIncoming.length > 0) {
    return Math.min(1, 0.5 + (mainIncoming[0]?.confidence ?? 0) * 0.5);
  }
  if (mainOutgoing.length > 1) return 0.4;
  if (mainIncoming.length > 0) return 0.65;
  return 0.45;
}

function penaltiesFor(
  file: RawFileMetadata,
  family: FileFamily,
  graph: SerializedVersionGraph,
  timeline: TimelineRiskAnalysis,
): MainVersionPenalty[] {
  const categories = new Set(file.analysis.versionTokens.map((token) => token.category));
  const penalties: MainVersionPenalty[] = [];
  const add = (type: MainVersionPenalty['type'], value: number, description: string) =>
    penalties.push({ type, value, description });
  if (categories.has('backup')) add('backup_marker', 0.2, '文件名包含备份、旧版或归档标记。');
  if (categories.has('copy')) add('copy_marker', 0.14, '文件名包含副本或复制标记。');
  if (categories.has('temporary')) add('temporary_marker', 0.25, '文件名包含临时、测试或预览标记。');
  if (graph.edges.some((edge) => edge.role === 'main' && edge.sourceFileId === file.id)) {
    add('has_successor', 0.18, '版本图中存在明确的后继文件。');
  }
  if (
    timeline.risks.some(
      (risk) => risk.type === 'revived_old_branch' && risk.relatedFileIds.includes(file.id),
    )
  ) {
    add('revived_branch', 0.12, '文件关联到长期停止后恢复活动的分支。');
  }
  if (
    timeline.risks.some(
      (risk) => risk.type === 'timeline_name_conflict' && risk.relatedFileIds.includes(file.id),
    )
  ) {
    add('timeline_conflict', 0.1, '版本命名与时间顺序存在冲突。');
  }
  if (family.fileIds.length === 1) add('isolated_file', 0.08, '该文件尚未找到同家族版本。');
  return penalties;
}

function evidenceFor(
  breakdown: MainVersionScoreBreakdown,
  penalties: MainVersionPenalty[],
  riskWarnings: string[],
): MainVersionEvidence[] {
  const labels: Record<keyof MainVersionScoreBreakdown, string> = {
    recencyScore: '在家族内的相对活跃时间。',
    graphLeafScore: '是否位于主版本图的叶节点。',
    versionMarkerScore: '最终、提交、修改或数字版本标记。',
    directoryIntentScore: '所在目录是否表达正式、交付或归档意图。',
    branchCentralityScore: '在主版本链或分支中的图位置。',
    sizePlausibilityScore: '文件大小与家族中位数的接近程度。',
    userConfirmationScore: '用户确认信号；MVP 当前尚未提供。',
  };
  return [
    ...Object.entries(breakdown).map(([type, value]) => ({
      type: type as keyof MainVersionScoreBreakdown,
      description: labels[type as keyof MainVersionScoreBreakdown],
      value,
      impact: value >= 0.7 ? ('positive' as const) : ('neutral' as const),
    })),
    ...penalties.map((penalty) => ({
      type: penalty.type,
      description: penalty.description,
      value: penalty.value,
      impact: 'negative' as const,
    })),
    ...riskWarnings.map((warning) => ({
      type: 'risk_link' as const,
      description: warning,
      impact: 'negative' as const,
    })),
  ];
}

function scoreCandidate(
  file: RawFileMetadata,
  family: FileFamily,
  familyFiles: RawFileMetadata[],
  recency: Map<string, number>,
  graph: SerializedVersionGraph,
  timeline: TimelineRiskAnalysis,
): Omit<MainVersionCandidate, 'rank'> {
  const familyMedian = median(familyFiles.map((item) => item.size));
  const breakdown: MainVersionScoreBreakdown = {
    recencyScore: recency.get(file.id) ?? 0,
    graphLeafScore: graph.leafFileIds.includes(file.id) ? 1 : 0.2,
    versionMarkerScore: versionMarkerScore(file),
    directoryIntentScore: directoryIntentScore(file.parentDirectory),
    branchCentralityScore: branchCentralityScore(file.id, graph),
    sizePlausibilityScore: sizePlausibilityScore(file.size, familyMedian),
    userConfirmationScore: 0,
  };
  const penalties = penaltiesFor(file, family, graph, timeline);
  const penaltyTotal = penalties.reduce((sum, penalty) => sum + penalty.value, 0);
  const score = clamp(
    0.22 * breakdown.recencyScore +
      0.22 * breakdown.graphLeafScore +
      0.16 * breakdown.versionMarkerScore +
      0.14 * breakdown.directoryIntentScore +
      0.12 * breakdown.branchCentralityScore +
      0.08 * breakdown.sizePlausibilityScore +
      0.06 * breakdown.userConfirmationScore -
      penaltyTotal,
  );
  const riskWarnings = timeline.risks
    .filter((risk) => risk.relatedFileIds.includes(file.id))
    .map((risk) => `${risk.title}：${risk.recommendation}`);
  const warnings = [
    ...riskWarnings,
    ...(score < 0.55 ? ['候选置信度较低，应由用户人工确认。'] : []),
    DISCLAIMER,
  ];
  return {
    fileId: file.id,
    familyId: family.id,
    score,
    confidence: score,
    confidenceText: confidencePhrase(score),
    recommended: score >= 0.4,
    scoreBreakdown: breakdown,
    penalties,
    evidence: evidenceFor(breakdown, penalties, riskWarnings),
    warnings,
  };
}

export function rankMainVersionCandidates(
  files: RawFileMetadata[],
  families: FileFamily[],
  graph: SerializedVersionGraph,
  timeline: TimelineRiskAnalysis,
): MainVersionRanking {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const candidates = families.flatMap((family) => {
    const familyFiles = family.fileIds
      .map((fileId) => fileById.get(fileId))
      .filter((file): file is RawFileMetadata => file !== undefined);
    const recency = recencyScores(familyFiles);
    return familyFiles
      .map((file) => scoreCandidate(file, family, familyFiles, recency, graph, timeline))
      .sort((left, right) => right.score - left.score || left.fileId.localeCompare(right.fileId))
      .slice(0, 3)
      .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
  });
  return { candidates, disclaimer: DISCLAIMER };
}
