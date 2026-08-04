// @vitest-environment node

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeFilename } from '../analysis/filename-analyzer';
import {
  directoryRelationScore,
  orderVersionPair,
  scoreParentCandidate,
  sizeContinuityScore,
  timeOrderScore,
  versionProgressionScore,
} from '../inference/edge-scorer';
import type { RawFileMetadata } from '../contracts/scan';

function file(
  name: string,
  options: { modifiedAt?: string; size?: number; directory?: string } = {},
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
    modifiedAt: options.modifiedAt ?? '2026-05-12T08:00:00.000Z',
    analysis: analyzeFilename(name),
  };
}

describe('version edge scorer', () => {
  it('scores time intervals without overvaluing near-simultaneous copies', () => {
    const source = file('brief_v1.docx');
    expect(timeOrderScore(source, file('brief_v2.docx', { modifiedAt: '2026-05-12T08:05:00.000Z' }))).toBe(0.65);
    expect(timeOrderScore(source, file('brief_v2.docx', { modifiedAt: '2026-05-12T09:00:00.000Z' }))).toBe(1);
    expect(timeOrderScore(source, file('brief_v2.docx', { modifiedAt: '2026-05-11T08:00:00.000Z' }))).toBe(0.1);
  });

  it('implements size and directory continuity bands', () => {
    expect(sizeContinuityScore(100, 105)).toBe(1);
    expect(sizeContinuityScore(100, 200)).toBe(0.7);
    expect(sizeContinuityScore(100, 1000)).toBe(0.2);
    expect(directoryRelationScore('working', 'working')).toBe(1);
    expect(directoryRelationScore('working', 'working/review')).toBe(0.85);
    expect(directoryRelationScore('working/a', 'working/b')).toBe(0.7);
  });

  it('prefers adjacent numeric progression and keeps time conflicts as evidence', () => {
    const v1 = file('brief_v1.docx', { modifiedAt: '2026-05-12T08:00:00.000Z' });
    const v2 = file('brief_v2.docx', { modifiedAt: '2026-05-11T08:00:00.000Z' });
    const v4 = file('brief_v4.docx', { modifiedAt: '2026-05-10T08:00:00.000Z' });

    expect(orderVersionPair(v1, v2)).toEqual({ source: v1, target: v2 });
    expect(versionProgressionScore(v1, v2)).toBe(0.95);
    expect(versionProgressionScore(v1, v4)).toBe(0.78);
    expect(scoreParentCandidate(v1, v2)?.evidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'time_order', impact: 'negative' })]),
    );
  });
});
