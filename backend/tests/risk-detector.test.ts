// @vitest-environment node

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeFilename } from '../analysis/filename-analyzer';
import { clusterFileFamilies } from '../clustering/family-clusterer';
import type { FileFamily } from '../contracts/family-clustering';
import type { RawFileMetadata } from '../contracts/scan';
import type { ProjectEvent } from '../contracts/timeline-risk';
import type { SerializedVersionGraph, VersionEdge } from '../contracts/version-graph';
import {
  detectBranchExplosion,
  detectIsolatedNewVersions,
  detectMultipleFinalVersions,
  detectRevivedBranchRisks,
  detectShadowCopies,
  detectTimelineNameConflicts,
} from '../risks/risk-detector';

function file(name: string, modifiedAt = '2026-05-12T08:00:00.000Z', directory = 'working'): RawFileMetadata {
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

function graph(files: RawFileMetadata[], overrides: Partial<SerializedVersionGraph> = {}): SerializedVersionGraph {
  return { schemaVersion: '1.0', nodes: [], edges: [], rootFileIds: files.map((item) => item.id), leafFileIds: files.map((item) => item.id), branchPointFileIds: [], ...overrides };
}

describe('project risk detector', () => {
  it('detects multiple final versions', () => {
    const files = [file('brief_final.docx'), file('brief_submitted.pdf')];
    const risks = detectMultipleFinalVersions(files, [family('brief', files)], graph(files));
    expect(risks).toEqual([expect.objectContaining({ type: 'multiple_final_versions', severity: 'medium' })]);
  });

  it('turns revived branch events into an evidence-backed risk', () => {
    const revivedEvent: ProjectEvent = {
      id: 'event:revived', type: 'old_branch_revived', startAt: '2026-05-20T00:00:00.000Z', title: 'revived', description: 'possible revival', confidence: 0.72, relatedFileIds: ['a', 'b'], relatedFamilyIds: ['f'], evidence: [{ type: 'time_range', description: 'gap', value: 19, impact: 'positive' }],
    };
    const risks = detectRevivedBranchRisks([revivedEvent]);
    expect(risks).toEqual([expect.objectContaining({ type: 'revived_old_branch' })]);
    expect(risks[0].evidence.length).toBeGreaterThan(0);
  });

  it('detects a recent cross-directory shadow copy without a graph edge', () => {
    const files = [
      file('brief_final.docx', '2026-05-12T08:00:00.000Z', 'working'),
      file('brief_final.docx', '2026-05-12T09:00:00.000Z', 'delivery'),
    ];
    const clustering = clusterFileFamilies(files);
    expect(detectShadowCopies(files, clustering, graph(files))).toEqual([
      expect.objectContaining({ type: 'cross_directory_shadow_copy' }),
    ]);
  });

  it('detects branch explosion from four family leaves', () => {
    const files = Array.from({ length: 4 }, (_, index) => file(`brief_branch_${index}.docx`));
    expect(detectBranchExplosion([family('brief', files)], graph(files))).toEqual([
      expect.objectContaining({ type: 'branch_explosion', severity: 'high' }),
    ]);
  });

  it('detects time and filename progression conflicts', () => {
    const files = [file('brief_v2.docx'), file('brief_v4.docx')];
    const conflictEdge: VersionEdge = {
      id: 'edge:conflict', familyId: 'brief', sourceFileId: files[0].id, targetFileId: files[1].id, role: 'main', relation: 'possible_successor', confidence: 0.7,
      scoreBreakdown: { nameSimilarity: 1, timeOrderScore: 0.1, sizeContinuityScore: 1, directoryRelationScore: 1, versionProgressionScore: 0.95 },
      evidence: [{ type: 'time_order', description: 'time conflict', value: 0.1, impact: 'negative' }], overriddenByUser: false,
    };
    expect(detectTimelineNameConflicts(graph(files, { edges: [conflictEdge] }))).toEqual([
      expect.objectContaining({ type: 'timeline_name_conflict' }),
    ]);
  });

  it('detects a backup as the newest file and revisions after submission', () => {
    const files = [
      file('brief_submitted.docx', '2026-05-10T08:00:00.000Z'),
      file('brief_revision.docx', '2026-05-11T08:00:00.000Z'),
      file('brief_backup.docx', '2026-05-12T08:00:00.000Z'),
    ];
    const risks = detectTimelineNameConflicts(graph(files), files, [family('brief', files)]);
    expect(risks).toEqual([expect.objectContaining({ type: 'timeline_name_conflict', severity: 'high' })]);
    expect(risks[0].evidence).toHaveLength(2);
  });

  it('detects a v2+ singleton without a credible parent', () => {
    const isolated = file('orphan_v2.docx');
    expect(detectIsolatedNewVersions([isolated], [family('orphan', [isolated])], graph([isolated]))).toEqual([
      expect.objectContaining({ type: 'isolated_new_version', evidence: expect.any(Array) }),
    ]);
  });
});
