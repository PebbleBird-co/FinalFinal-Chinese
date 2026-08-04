// @vitest-environment node

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeFilename } from '../analysis/filename-analyzer';
import { clusterFileFamilies } from '../clustering/family-clusterer';
import type { UserOverride, UserOverrideType } from '../contracts/override';
import type { RawFileMetadata, ScanResult } from '../contracts/scan';
import { buildVersionGraph } from '../inference/graph-builder';
import { applyOverrides, OverrideValidationError } from '../overrides/override-applier';
import { rankMainVersionCandidates } from '../ranking/main-version-ranker';
import { analyzeTimelineAndRisks } from '../timeline/timeline-analyzer';

function file(name: string, day: number): RawFileMetadata {
  const relativePath = join('working', name);
  return {
    id: `file:${relativePath.replaceAll('\\', '/')}`,
    name,
    extension: 'docx',
    absolutePath: join('C:\\project', relativePath),
    relativePath,
    parentDirectory: 'working',
    directoryDepth: 1,
    size: 1000 + day * 10,
    modifiedAt: `2026-05-${String(day).padStart(2, '0')}T08:00:00.000Z`,
    analysis: analyzeFilename(name),
  };
}

function baseResult(): ScanResult {
  const files = [
    file('brief_v1.docx', 10),
    file('brief_v2.docx', 11),
    file('brief_final.docx', 12),
    file('budget_v1.docx', 13),
  ];
  const clustering = clusterFileFamilies(files);
  const versionGraph = buildVersionGraph(files, clustering.families);
  const timeline = analyzeTimelineAndRisks(files, clustering, versionGraph);
  return {
    scanId: 'scan-overrides',
    rootPath: 'C:\\project',
    scannedAt: '2026-05-13T09:00:00.000Z',
    completedAt: '2026-05-13T09:00:01.000Z',
    status: 'completed',
    limits: { maxFiles: 20_000, maxDepth: 20 },
    files,
    clustering,
    versionGraph,
    timeline,
    mainVersions: rankMainVersionCandidates(files, clustering.families, versionGraph, timeline),
    warnings: [],
  };
}

function override(type: UserOverrideType, targetIds: string[], index = 1): UserOverride {
  return {
    id: `override-${index}`,
    type,
    targetIds,
    payload: {},
    createdAt: `2026-05-13T09:00:0${index}.000Z`,
  };
}

describe('override applier', () => {
  it('promotes a user-confirmed main version and excludes later abandoned or copy marks', () => {
    const base = baseResult();
    const family = base.clustering.families.find((item) => item.fileIds.length >= 3)!;
    const selected = family.fileIds[0];
    const promoted = applyOverrides(base, [override('set_main_version', [selected])]);
    const candidate = promoted.mainVersions.candidates.find((item) => item.familyId === family.id && item.rank === 1);

    expect(candidate).toMatchObject({ fileId: selected, score: 1, confidenceText: '用户已确认' });
    expect(candidate?.scoreBreakdown.userConfirmationScore).toBe(1);

    const abandoned = applyOverrides(base, [
      override('set_main_version', [selected]),
      override('mark_abandoned', [selected], 2),
    ]);
    expect(abandoned.mainVersions.candidates.some((item) => item.fileId === selected)).toBe(false);

    const copied = applyOverrides(base, [override('mark_as_copy', [selected])]);
    expect(copied.mainVersions.candidates.some((item) => item.fileId === selected)).toBe(false);
  });

  it('sets and removes a user-confirmed parent edge and rejects cycles', () => {
    const base = baseResult();
    const family = base.clustering.families.find((item) => item.fileIds.length >= 3)!;
    const sorted = family.fileIds
      .map((id) => base.files.find((item) => item.id === id)!)
      .sort((left, right) => left.modifiedAt.localeCompare(right.modifiedAt));
    const parent = sorted[0].id;
    const child = sorted.at(-1)!.id;
    const parentOverride = override('set_parent', [parent, child]);
    const corrected = applyOverrides(base, [parentOverride]);
    const forced = corrected.versionGraph.edges.find((edge) => edge.id === `edge:user:${parentOverride.id}`);

    expect(forced).toMatchObject({ sourceFileId: parent, targetFileId: child, confidence: 1, overriddenByUser: true });
    const removed = applyOverrides(base, [parentOverride, override('remove_edge', [forced!.id], 2)]);
    expect(removed.versionGraph.edges.some((edge) => edge.id === forced!.id)).toBe(false);
    expect(() => applyOverrides(base, [override('set_parent', [child, parent])])).toThrow(OverrideValidationError);
  });

  it('splits a file and can merge the resulting family into another family', () => {
    const base = baseResult();
    const source = base.clustering.families.find((item) => item.fileIds.length >= 3)!;
    const target = base.clustering.families.find((item) => item.id !== source.id)!;
    const fileId = source.fileIds[0];
    const split = override('split_family', [fileId]);
    const splitResult = applyOverrides(base, [split]);
    const splitFamily = splitResult.clustering.families.find((item) => item.fileIds.length === 1 && item.fileIds[0] === fileId)!;

    expect(splitResult.clustering.families).toHaveLength(base.clustering.families.length + 1);
    const merged = applyOverrides(base, [split, override('merge_families', [splitFamily.id, target.id], 2)]);
    expect(merged.clustering.families.find((item) => item.id === target.id)?.fileIds).toContain(fileId);
    expect(merged.clustering.families.some((item) => item.id === splitFamily.id)).toBe(false);
  });
});
