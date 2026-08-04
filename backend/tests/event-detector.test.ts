// @vitest-environment node

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeFilename } from '../analysis/filename-analyzer';
import type { FileFamily } from '../contracts/family-clustering';
import type { RawFileMetadata } from '../contracts/scan';
import type { SerializedVersionGraph, VersionEdge } from '../contracts/version-graph';
import { aggregateDailyActivity } from '../timeline/activity-aggregator';
import {
  detectActivityPeaks,
  detectBranchEvents,
  detectDirectionShift,
  detectFinalBursts,
  detectProjectStart,
  detectRevivedBranches,
} from '../timeline/event-detector';

function file(name: string, modifiedAt: string, directory = 'working'): RawFileMetadata {
  const relativePath = join(directory, name);
  return {
    id: `file:${relativePath.replaceAll('\\', '/')}`,
    name,
    extension: name.split('.').at(-1)?.toLowerCase() ?? '',
    absolutePath: join('C:\\project', relativePath),
    relativePath,
    parentDirectory: directory,
    directoryDepth: 1,
    size: 1000,
    modifiedAt,
    analysis: analyzeFilename(name),
  };
}

function family(id: string, files: RawFileMetadata[]): FileFamily {
  return { id, displayName: id, coreName: id, fileIds: files.map((item) => item.id), confidence: 0.9, evidence: [] };
}

function edge(source: RawFileMetadata, target: RawFileMetadata, familyId: string): VersionEdge {
  return {
    id: `edge:${source.id}:${target.id}`,
    familyId,
    sourceFileId: source.id,
    targetFileId: target.id,
    role: 'main',
    relation: 'likely_successor',
    confidence: 0.9,
    scoreBreakdown: {
      nameSimilarity: 1,
      timeOrderScore: 1,
      sizeContinuityScore: 1,
      directoryRelationScore: 1,
      versionProgressionScore: 0.95,
    },
    evidence: [],
    overriddenByUser: false,
  };
}

describe('project event detector', () => {
  it('aggregates daily activity and excludes an isolated old file from project start', () => {
    const old = file('orphan.txt', '2025-01-01T08:00:00.000Z');
    const active = [
      file('brief_v1.docx', '2026-05-12T08:00:00.000Z'),
      file('brief_v2.docx', '2026-05-12T10:00:00.000Z'),
      file('brief_v3.docx', '2026-05-13T10:00:00.000Z'),
    ];
    const families = [family('orphan', [old]), family('brief', active)];
    const daily = aggregateDailyActivity([old, ...active], families);
    const start = detectProjectStart([old, ...active], families);

    expect(daily.find((day) => day.date === '2026-05-12')).toMatchObject({ fileCount: 2, activeFamilyCount: 1 });
    expect(start?.startAt).toBe('2026-05-12T08:00:00.000Z');
    expect(start?.evidence).not.toHaveLength(0);
  });

  it('detects statistically high daily activity', () => {
    const files = [
      file('a.txt', '2026-05-10T08:00:00.000Z'),
      file('b.txt', '2026-05-11T08:00:00.000Z'),
      ...Array.from({ length: 5 }, (_, index) => file(`peak_${index}.txt`, `2026-05-12T${String(index + 8).padStart(2, '0')}:00:00.000Z`)),
    ];
    const families = files.map((item, index) => family(`f${index}`, [item]));
    const peaks = detectActivityPeaks(aggregateDailyActivity(files, families), files, families);
    expect(peaks).toEqual([expect.objectContaining({ type: 'activity_peak', confidence: expect.any(Number) })]);
  });

  it('requires branch successors to continue independently', () => {
    const files = [
      file('brief_v1.docx', '2026-05-10T08:00:00.000Z'),
      file('brief_v2.docx', '2026-05-11T08:00:00.000Z', 'alpha'),
      file('brief_v2.docx', '2026-05-11T10:00:00.000Z', 'beta'),
      file('brief_v3.docx', '2026-05-12T08:00:00.000Z', 'alpha'),
      file('brief_v3.docx', '2026-05-12T10:00:00.000Z', 'beta'),
    ];
    const edges = [
      edge(files[0], files[1], 'brief'),
      edge(files[0], files[2], 'brief'),
      edge(files[1], files[3], 'brief'),
      edge(files[2], files[4], 'brief'),
    ];
    const graph: SerializedVersionGraph = {
      schemaVersion: '1.0', nodes: [], edges, rootFileIds: [files[0].id], leafFileIds: [files[3].id, files[4].id], branchPointFileIds: [files[0].id],
    };
    expect(detectBranchEvents(files, graph)).toEqual([
      expect.objectContaining({ type: 'branch_created', relatedFamilyIds: ['brief'] }),
    ]);
  });

  it('emits direction shift only after multiple independent signals', () => {
    const oldFiles = [
      file('budget_v1.xlsx', '2026-05-01T08:00:00.000Z', 'old'),
      file('charter_v1.docx', '2026-05-02T08:00:00.000Z', 'old'),
      file('notes_v1.txt', '2026-05-03T08:00:00.000Z', 'old'),
    ];
    const newFiles = [
      file('launch_plan_v1.docx', '2026-05-10T08:00:00.000Z', 'strategy'),
      file('roadmap_v1.xlsx', '2026-05-10T09:00:00.000Z', 'strategy'),
      file('launch_plan_v2.docx', '2026-05-11T08:00:00.000Z', 'strategy'),
      file('roadmap_v2.xlsx', '2026-05-12T08:00:00.000Z', 'strategy'),
    ];
    const families = [
      ...oldFiles.map((item, index) => family(`old-${index}`, [item])),
      family('launch', [newFiles[0], newFiles[2]]),
      family('roadmap', [newFiles[1], newFiles[3]]),
    ];
    const events = detectDirectionShift([...oldFiles, ...newFiles], families);
    expect(events).toEqual([expect.objectContaining({ type: 'direction_shift' })]);
    expect(events[0].confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('detects a revived family after a fourteen-day gap', () => {
    const revived = [
      file('legacy_v1.docx', '2026-05-01T08:00:00.000Z'),
      file('legacy_v2.docx', '2026-05-20T08:00:00.000Z'),
    ];
    const competing = file('current_v4.docx', '2026-05-10T08:00:00.000Z');
    expect(detectRevivedBranches([...revived, competing], [family('legacy', revived), family('current', [competing])])).toEqual([
      expect.objectContaining({ type: 'old_branch_revived' }),
    ]);
  });

  it('detects three final markers inside a 48-hour window', () => {
    const files = [
      file('brief_final.docx', '2026-05-12T08:00:00.000Z'),
      file('brief_submitted.pdf', '2026-05-12T18:00:00.000Z'),
      file('brief_final_v2.docx', '2026-05-13T08:00:00.000Z'),
    ];
    expect(detectFinalBursts(files, [family('brief', files)])).toEqual([
      expect.objectContaining({ type: 'final_version_burst', relatedFileIds: expect.arrayContaining(files.map((item) => item.id)) }),
    ]);
  });
});
