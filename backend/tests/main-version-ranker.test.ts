// @vitest-environment node

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeFilename } from '../analysis/filename-analyzer';
import { clusterFileFamilies } from '../clustering/family-clusterer';
import type { RawFileMetadata } from '../contracts/scan';
import type { TimelineRiskAnalysis } from '../contracts/timeline-risk';
import { buildVersionGraph } from '../inference/graph-builder';
import { confidencePhrase } from '../ranking/confidence-language';
import { rankMainVersionCandidates } from '../ranking/main-version-ranker';
import { analyzeTimelineAndRisks } from '../timeline/timeline-analyzer';

function file(
  name: string,
  modifiedAt: string,
  options: { directory?: string; size?: number } = {},
): RawFileMetadata {
  const directory = options.directory ?? 'working';
  const relativePath = join(directory, name);
  return {
    id: `file:${relativePath.replaceAll('\\', '/')}`,
    name,
    extension: name.split('.').at(-1)?.toLowerCase() ?? '',
    absolutePath: join('C:\\project', relativePath),
    relativePath,
    parentDirectory: directory,
    directoryDepth: 1,
    size: options.size ?? 1000,
    modifiedAt,
    analysis: analyzeFilename(name),
  };
}

function rank(files: RawFileMetadata[], timelineOverride?: TimelineRiskAnalysis) {
  const clustering = clusterFileFamilies(files);
  const graph = buildVersionGraph(files, clustering.families);
  const timeline = timelineOverride ?? analyzeTimelineAndRisks(files, clustering, graph);
  return rankMainVersionCandidates(files, clustering.families, graph, timeline);
}

describe('main version ranker', () => {
  it('does not rank an old final marker above a newer leaf with successor evidence', () => {
    const oldFinal = file('brief_final_v1.docx', '2026-05-10T08:00:00.000Z');
    const newerRevision = file('brief_revision_v2.docx', '2026-05-12T08:00:00.000Z');
    const result = rank([oldFinal, newerRevision]);
    const familyCandidates = result.candidates.filter(
      (candidate) => candidate.familyId === result.candidates[0].familyId,
    );

    expect(familyCandidates[0].fileId).toBe(newerRevision.id);
    expect(familyCandidates.find((candidate) => candidate.fileId === oldFinal.id)?.penalties).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'has_successor', value: 0.18 })]),
    );
    expect(result.disclaimer).toContain('只作为弱证据');
  });

  it('returns at most three candidates per family with complete evidence', () => {
    const files = Array.from({ length: 5 }, (_, index) =>
      file(`brief_v${index + 1}.docx`, `2026-05-${String(index + 10).padStart(2, '0')}T08:00:00.000Z`),
    );
    const result = rank(files);

    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.map((candidate) => candidate.rank)).toEqual([1, 2, 3]);
    expect(result.candidates.every((candidate) => candidate.evidence.length >= 3)).toBe(true);
  });

  it('applies marker and isolated-file penalties and marks a very low score as not recommended', () => {
    const lowConfidence = file(
      'brief_backup_copy_temp.docx',
      '2026-05-12T08:00:00.000Z',
      { directory: 'archive' },
    );
    const candidate = rank([lowConfidence]).candidates[0];

    expect(candidate.penalties.map((penalty) => penalty.type)).toEqual(
      expect.arrayContaining(['backup_marker', 'copy_marker', 'temporary_marker', 'isolated_file']),
    );
    expect(candidate.recommended).toBe(false);
    expect(candidate.confidenceText).toBe('不建议作为正式候选');
    expect(candidate.warnings).toContain('候选置信度较低，应由用户人工确认。');
  });

  it('links candidate warnings to related project risks', () => {
    const candidateFile = file('brief_final_v2.docx', '2026-05-12T08:00:00.000Z');
    const timeline: TimelineRiskAnalysis = {
      dailyActivity: [],
      events: [],
      risks: [
        {
          id: 'risk:conflict',
          type: 'timeline_name_conflict',
          severity: 'medium',
          title: '时间与版本命名可能冲突',
          description: 'conflict',
          confidence: 0.8,
          relatedFileIds: [candidateFile.id],
          relatedFamilyIds: [],
          evidence: [],
          recommendation: '检查修改时间。',
        },
      ],
    };
    const candidate = rank([candidateFile], timeline).candidates[0];

    expect(candidate.penalties).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'timeline_conflict' })]),
    );
    expect(candidate.warnings.join(' ')).toContain('时间与版本命名可能冲突');
  });

  it('uses the required confidence language thresholds', () => {
    expect(confidencePhrase(0.85)).toBe('高度可信');
    expect(confidencePhrase(0.7)).toBe('较可能');
    expect(confidencePhrase(0.55)).toBe('存在一定可能');
    expect(confidencePhrase(0.4)).toBe('判断不稳定');
    expect(confidencePhrase(0.39)).toBe('不建议作为正式候选');
  });
});
