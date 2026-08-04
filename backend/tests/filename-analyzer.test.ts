// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { analyzeFilename } from '../analysis/filename-analyzer';

describe('filename analyzer', () => {
  it('normalizes Unicode and extracts version, date, and business name signals', () => {
    const result = analyzeFilename(
      '\u5ba2\u6237\u8fc1\u79fb\u65b9\u6848\uff08\u6700\u7ec8\u7248\uff09\uff36\uff12\uff0e\uff11_2026-05-12.DOCX',
    );

    expect(result.extension).toBe('docx');
    expect(result.normalizedName).toBe('\u5ba2\u6237\u8fc1\u79fb\u65b9\u6848 \u6700\u7ec8\u7248 v2.1 2026 05 12');
    expect(result.coreName).toBe('\u5ba2\u6237\u8fc1\u79fb');
    expect(result.numericVersion).toEqual([2, 1]);
    expect(result.versionTokens.map((token) => token.category)).toEqual(['final', 'numeric']);
    expect(result.dateTokens).toEqual([
      expect.objectContaining({ normalized: '2026-05-12', confidence: 'high' }),
    ]);
  });

  it.each([
    ['brief_v1.docx', [1]],
    ['brief_v2_1.docx', [2, 1]],
    ['brief_version 3.docx', [3]],
    ['brief_rev4.docx', [4]],
    ['brief_r5.docx', [5]],
    ['brief_\u7248\u672c2.docx', [2]],
    ['brief_\u7b2c3\u7248.docx', [3]],
  ])('extracts numeric version from %s', (name, expected) => {
    expect(analyzeFilename(name).numericVersion).toEqual(expected);
  });

  it('marks short dates as low-confidence and rejects invalid dates', () => {
    expect(analyzeFilename('brief_0512.docx').dateTokens).toEqual([
      expect.objectContaining({ normalized: '05-12', confidence: 'low' }),
    ]);
    expect(analyzeFilename('brief_0231.docx').dateTokens).toEqual([]);
  });

  it.each([
    ['brief_2026-05-12.docx', '2026-05-12', 'high'],
    ['brief_20260512.docx', '2026-05-12', 'high'],
    ['brief_2026.05.12.docx', '2026-05-12', 'high'],
    ['brief_2026\u5e745\u670812\u65e5.docx', '2026-05-12', 'high'],
    ['brief_5\u670812\u65e5.docx', '05-12', 'low'],
  ])('extracts supported date syntax from %s', (name, normalized, confidence) => {
    expect(analyzeFilename(name).dateTokens).toEqual([
      expect.objectContaining({ normalized, confidence }),
    ]);
  });

  it.each([
    ['brief_\u521d\u7a3f.docx', 'draft'],
    ['brief_\u4fee\u8ba2\u7248.docx', 'revision'],
    ['brief_latest.docx', 'new'],
    ['brief_\u5b9a\u7a3f.docx', 'final'],
    ['brief_submitted.docx', 'submitted'],
    ['brief_backup.docx', 'backup'],
    ['brief_copy.docx', 'copy'],
    ['brief_temp.docx', 'temporary'],
  ])('classifies version marker in %s', (name, category) => {
    expect(analyzeFilename(name).versionTokens).toEqual([
      expect.objectContaining({ category }),
    ]);
  });

  it('does not treat a marker character embedded in a business word as a version token', () => {
    const result = analyzeFilename('\u521b\u65b0\u65b9\u6848.docx');
    expect(result.versionTokens).toEqual([]);
    expect(result.coreName).toBe('\u521b\u65b0');
  });
});
