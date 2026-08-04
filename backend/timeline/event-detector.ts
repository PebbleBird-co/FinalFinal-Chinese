import { jaccardSimilarity } from '../analysis/filename-similarity';
import type { FileFamily } from '../contracts/family-clustering';
import type { RawFileMetadata } from '../contracts/scan';
import type { DailyActivity, ProjectEvent, TimelineEvidence } from '../contracts/timeline-risk';
import type { SerializedVersionGraph } from '../contracts/version-graph';
import { buildFileFamilyMap } from './activity-aggregator';

const DAY_MS = 24 * 60 * 60 * 1000;

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function event(
  type: ProjectEvent['type'],
  startAt: string,
  values: Omit<ProjectEvent, 'id' | 'type' | 'startAt'>,
): ProjectEvent {
  return { id: `event:${type}:${startAt}`, type, startAt, ...values };
}

function isTemporary(file: RawFileMetadata): boolean {
  return file.analysis.versionTokens.some((token) => token.category === 'temporary');
}

export function detectProjectStart(
  files: RawFileMetadata[],
  families: FileFamily[],
): ProjectEvent | undefined {
  if (files.length === 0) return undefined;
  const familyByFile = buildFileFamilyMap(families);
  const familySize = new Map(families.map((family) => [family.id, family.fileIds.length]));
  const sorted = files.filter((file) => !isTemporary(file)).sort((left, right) =>
    left.modifiedAt.localeCompare(right.modifiedAt),
  );
  if (sorted.length === 0) return undefined;
  if (sorted.length > 1) {
    const gap = Date.parse(sorted[1].modifiedAt) - Date.parse(sorted[0].modifiedAt);
    const firstFamily = familyByFile.get(sorted[0].id);
    if (gap > 90 * DAY_MS && (!firstFamily || familySize.get(firstFamily) === 1)) sorted.shift();
  }
  if (sorted.length === 0) return undefined;
  const sample = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.1)));
  const startAt = sample[0].modifiedAt;
  const endAt = sample.at(-1)?.modifiedAt;
  const relatedFamilyIds = unique(
    sample.map((file) => familyByFile.get(file.id)).filter((id) => id !== undefined),
  );
  return event('project_start', startAt, {
    ...(endAt && endAt !== startAt ? { endAt } : {}),
    title: '可能的项目活跃起点',
    description: `现有元数据显示，项目可能在 ${startAt.slice(0, 10)} 前后开始活跃。`,
    confidence: sample.length >= 2 ? 0.72 : 0.58,
    relatedFileIds: sample.map((file) => file.id),
    relatedFamilyIds,
    evidence: [
      {
        type: 'time_range',
        description: '使用最早 10% 的有效活动文件范围，并排除孤立旧文件与临时文件。',
        value: sample.length,
        impact: 'positive',
      },
    ],
  });
}

export function detectActivityPeaks(
  dailyActivity: DailyActivity[],
  files: RawFileMetadata[],
  families: FileFamily[],
): ProjectEvent[] {
  if (dailyActivity.length < 2 || Math.max(...dailyActivity.map((day) => day.fileCount)) <= 1) return [];
  const counts = dailyActivity.map((day) => day.fileCount);
  const mean = counts.reduce((sum, value) => sum + value, 0) / counts.length;
  const deviation = Math.sqrt(
    counts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / counts.length,
  );
  const sortedCounts = [...counts].sort((left, right) => left - right);
  const percentile85 = sortedCounts[Math.max(0, Math.ceil(sortedCounts.length * 0.85) - 1)];
  const threshold = dailyActivity.length < 7 ? percentile85 : mean + 1.5 * deviation;
  const familyByFile = buildFileFamilyMap(families);

  return dailyActivity
    .filter((day) => day.fileCount >= threshold && day.fileCount > mean)
    .map((day) => {
      const relatedFiles = files.filter((file) => file.modifiedAt.startsWith(day.date));
      return event('activity_peak', `${day.date}T00:00:00.000Z`, {
        title: '可能的活动峰值',
        description: `${day.date} 的文件活动量明显高于其他日期，可能是集中修改或批量复制。`,
        confidence: dailyActivity.length < 7 ? 0.65 : 0.78,
        relatedFileIds: relatedFiles.map((file) => file.id),
        relatedFamilyIds: unique(
          relatedFiles.map((file) => familyByFile.get(file.id)).filter((id) => id !== undefined),
        ),
        evidence: [
          {
            type: 'activity_count',
            description: dailyActivity.length < 7
              ? '活动量位于样本的前 15%。'
              : '活动量高于平均值加 1.5 倍标准差。',
            value: day.fileCount,
            impact: 'positive',
          },
        ],
      });
    });
}

export function detectBranchEvents(
  files: RawFileMetadata[],
  graph: SerializedVersionGraph,
): ProjectEvent[] {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const mainEdges = graph.edges.filter((edge) => edge.role === 'main');
  return graph.branchPointFileIds.flatMap((branchFileId) => {
    const outgoing = mainEdges.filter((edge) => edge.sourceFileId === branchFileId && edge.confidence >= 0.64);
    if (outgoing.length < 2) return [];
    const successors = outgoing.map((edge) => fileById.get(edge.targetFileId)).filter((file) => file !== undefined);
    const times = successors.map((file) => Date.parse(file.modifiedAt));
    if (times.length < 2 || Math.max(...times) - Math.min(...times) > 72 * 60 * 60 * 1000) return [];
    const continuing = successors.filter((file) =>
      mainEdges.some((edge) => edge.sourceFileId === file.id),
    );
    if (continuing.length < 2) return [];
    const familyId = outgoing[0].familyId;
    const evidence: TimelineEvidence[] = [
      {
        type: 'graph_branch',
        description: '一个父节点在 72 小时内出现至少两个高分后继，且后继继续独立演化。',
        value: successors.length,
        impact: 'positive',
      },
    ];
    return [
      event('branch_created', successors[0].modifiedAt, {
        endAt: successors.at(-1)?.modifiedAt,
        title: '可能形成版本分支',
        description: '版本图中出现了短时间内形成、随后独立演化的多个后继方向。',
        confidence: Math.min(0.92, outgoing.reduce((sum, edge) => sum + edge.confidence, 0) / outgoing.length),
        relatedFileIds: [branchFileId, ...successors.map((file) => file.id)],
        relatedFamilyIds: [familyId],
        evidence,
      }),
    ];
  });
}

export function detectDirectionShift(
  files: RawFileMetadata[],
  families: FileFamily[],
): ProjectEvent[] {
  if (files.length < 6) return [];
  const familyByFile = buildFileFamilyMap(families);
  const sorted = [...files].sort((left, right) => left.modifiedAt.localeCompare(right.modifiedAt));
  const firstDate = Date.parse(sorted[0].modifiedAt);
  const directories = unique(sorted.map((file) => file.parentDirectory).filter(Boolean));
  const candidates: ProjectEvent[] = [];

  for (const directory of directories) {
    const directoryFiles = sorted.filter((file) => file.parentDirectory === directory);
    const shiftAt = directoryFiles[0];
    if (Date.parse(shiftAt.modifiedAt) === firstDate) continue;
    const before = sorted.filter((file) => file.modifiedAt < shiftAt.modifiedAt);
    const after = sorted.filter((file) => file.modifiedAt >= shiftAt.modifiedAt);
    if (before.length < 2 || after.length < 3) continue;
    let signals = 1;
    const newFamilies = unique(
      directoryFiles.map((file) => familyByFile.get(file.id)).filter((id) => id !== undefined),
    ).filter((familyId) => !before.some((file) => familyByFile.get(file.id) === familyId));
    if (newFamilies.length >= 2) signals += 1;
    const beforeFamilies = unique(before.map((file) => familyByFile.get(file.id)).filter((id) => id !== undefined));
    if (beforeFamilies.some((familyId) => !after.some((file) => familyByFile.get(file.id) === familyId))) signals += 1;
    const directoryShare = after.filter((file) => file.parentDirectory === directory).length / after.length;
    if (directoryShare >= 0.5) signals += 1;
    const beforeTokens = new Set(before.flatMap((file) => file.analysis.semanticTokens));
    const afterTokens = new Set(after.flatMap((file) => file.analysis.semanticTokens));
    const themeSimilarity = jaccardSimilarity(beforeTokens, afterTokens);
    if (beforeTokens.size > 0 && afterTokens.size > 0 && themeSimilarity < 0.4) signals += 1;
    const confidence = Math.min(0.9, 0.45 + signals * 0.1);
    if (signals < 3 || confidence < 0.6) continue;
    candidates.push(
      event('direction_shift', shiftAt.modifiedAt, {
        title: '可能出现活动方向调整',
        description: `现有元数据显示，活动重心可能在 ${directory} 目录出现后发生变化。`,
        confidence,
        relatedFileIds: after.filter((file) => file.parentDirectory === directory).map((file) => file.id),
        relatedFamilyIds: newFamilies,
        evidence: [
          { type: 'directory_shift', description: '至少三项目录、家族与命名主题信号同时出现。', value: signals, impact: 'positive' },
          { type: 'name_similarity', description: '调整前后业务词集合的相似度。', value: themeSimilarity, impact: 'neutral' },
        ],
      }),
    );
  }
  return candidates.slice(0, 3);
}

export function detectRevivedBranches(
  files: RawFileMetadata[],
  families: FileFamily[],
): ProjectEvent[] {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const events: ProjectEvent[] = [];
  for (const family of families) {
    const familyFiles = family.fileIds
      .map((id) => fileById.get(id))
      .filter((file) => file !== undefined)
      .sort((left, right) => left.modifiedAt.localeCompare(right.modifiedAt));
    for (let index = 1; index < familyFiles.length; index += 1) {
      const gap = Date.parse(familyFiles[index].modifiedAt) - Date.parse(familyFiles[index - 1].modifiedAt);
      if (gap < 14 * DAY_MS) continue;
      const competing = files.filter((file) =>
        !family.fileIds.includes(file.id) &&
        file.modifiedAt > familyFiles[index - 1].modifiedAt &&
        file.modifiedAt <= familyFiles[index].modifiedAt,
      );
      if (competing.length === 0) continue;
      events.push(
        event('old_branch_revived', familyFiles[index].modifiedAt, {
          title: '可能有旧分支恢复活动',
          description: '一个文件家族停止活动超过 14 天后再次出现修改，同期其他家族仍较活跃。',
          confidence: 0.72,
          relatedFileIds: [familyFiles[index - 1].id, familyFiles[index].id, ...competing.map((file) => file.id)],
          relatedFamilyIds: [family.id],
          evidence: [
            { type: 'time_range', description: '该家族连续活动之间存在超过 14 天的间隔。', value: Math.round(gap / DAY_MS), impact: 'positive' },
            { type: 'family_activity', description: '间隔期间存在其他活跃文件家族。', value: competing.length, impact: 'positive' },
          ],
        }),
      );
      break;
    }
  }
  return events;
}

export function detectFinalBursts(
  files: RawFileMetadata[],
  families: FileFamily[],
): ProjectEvent[] {
  const familyByFile = buildFileFamilyMap(families);
  const marked = files
    .filter((file) => file.analysis.versionTokens.some((token) => token.category === 'final' || token.category === 'submitted'))
    .sort((left, right) => left.modifiedAt.localeCompare(right.modifiedAt));
  for (let start = 0; start < marked.length; start += 1) {
    const end = marked.filter((file) =>
      Date.parse(file.modifiedAt) >= Date.parse(marked[start].modifiedAt) &&
      Date.parse(file.modifiedAt) - Date.parse(marked[start].modifiedAt) <= 48 * 60 * 60 * 1000,
    );
    if (end.length < 3) continue;
    return [
      event('final_version_burst', marked[start].modifiedAt, {
        endAt: end.at(-1)?.modifiedAt,
        title: '可能进入最终版集中期',
        description: `48 小时内出现了 ${end.length} 个带有最终或提交标记的文件，值得人工确认。`,
        confidence: Math.min(0.9, 0.6 + end.length * 0.06),
        relatedFileIds: end.map((file) => file.id),
        relatedFamilyIds: unique(end.map((file) => familyByFile.get(file.id)).filter((id) => id !== undefined)),
        evidence: [
          { type: 'version_marker', description: '48 小时窗口内出现至少三个 final/submitted 标记。', value: end.length, impact: 'positive' },
        ],
      }),
    ];
  }
  return [];
}
