// @vitest-environment node

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeFilename } from '../analysis/filename-analyzer';
import { generateCandidatePairs } from '../clustering/candidate-generator';
import { clusterFileFamilies, scoreFamilyCandidate } from '../clustering/family-clusterer';
import type { RawFileMetadata } from '../contracts/scan';

function file(name: string, options: { directory?: string; size?: number } = {}): RawFileMetadata {
  const directory = options.directory ?? 'working';
  const relativePath = join(directory, name);
  return {
    id: `file:${relativePath.replaceAll('\\', '/')}`,
    name,
    extension: name.split('.').at(-1)?.toLowerCase() ?? '',
    absolutePath: join('C:\\project', relativePath),
    relativePath,
    parentDirectory: directory,
    directoryDepth: directory.split(/[\\/]/).length,
    size: options.size ?? 1024,
    modifiedAt: '2026-05-12T08:00:00.000Z',
    analysis: analyzeFilename(name),
  };
}

describe('family clusterer', () => {
  it('clusters strong filename versions into one family', () => {
    const files = [
      file('client_migration_draft_v1.docx'),
      file('client_migration_revision_v2.docx'),
      file('client_migration_final_v3.pdf'),
      file('annual_budget.xlsx'),
    ];

    const result = clusterFileFamilies(files);
    const migrationFamily = result.families.find((family) => family.coreName === 'client migration');

    expect(migrationFamily?.fileIds).toHaveLength(3);
    expect(migrationFamily?.confidence).toBeGreaterThanOrEqual(0.78);
    expect(result.strongRelations.length).toBeGreaterThanOrEqual(2);
    expect(result.families).toHaveLength(2);
  });

  it('retains a weak cross-format relation without merging the files', () => {
    const left = file('client_migration_v1.docx', { size: 100 });
    const right = file('client_migration_v2.xlsx', { size: 5000 });
    const scored = scoreFamilyCandidate(left, right);
    const result = clusterFileFamilies([left, right]);

    expect(scored.similarity).toBeGreaterThanOrEqual(0.65);
    expect(scored.similarity).toBeLessThan(0.78);
    expect(scored.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'size_continuity', impact: 'negative' }),
        expect.objectContaining({ type: 'conflict', impact: 'negative' }),
      ]),
    );
    expect(result.families).toHaveLength(2);
    expect(result.weakRelations).toHaveLength(1);
  });

  it('does not merge unrelated files that only share generic words', () => {
    const files = [
      file('\u9879\u76ee\u65b9\u6848_\u6700\u7ec8\u7248.docx'),
      file('\u9879\u76ee\u62a5\u544a_\u6700\u7ec8\u7248.docx'),
      file('\u5ba2\u6237\u7532\u9884\u7b97_\u6700\u7ec8\u7248.xlsx'),
      file('\u5ba2\u6237\u4e59\u9884\u7b97_\u6700\u7ec8\u7248.xlsx'),
    ];

    const result = clusterFileFamilies(files);

    expect(result.families).toHaveLength(4);
    expect(result.strongRelations).toHaveLength(0);
    expect(result.families.every((family) => family.confidence === 0)).toBe(true);
  });

  it('uses bounded candidate buckets for 2,000 files', () => {
    const files = Array.from({ length: 2000 }, (_, index) =>
      file(`record_${String(index).padStart(4, '0')}.txt`),
    );
    const startedAt = Date.now();
    const candidates = generateCandidatePairs(files);
    const elapsed = Date.now() - startedAt;
    const totalPossiblePairs = (files.length * (files.length - 1)) / 2;

    expect(candidates.length).toBeLessThan(totalPossiblePairs / 10);
    expect(elapsed).toBeLessThan(3000);
  });
});
