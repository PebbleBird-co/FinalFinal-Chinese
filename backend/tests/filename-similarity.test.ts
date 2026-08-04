// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { analyzeFilename } from '../analysis/filename-analyzer';
import {
  calculateFilenameSimilarity,
  extensionCompatibility,
  lcsRatio,
  levenshteinSimilarity,
  ngramJaccard,
} from '../analysis/filename-similarity';

describe('filename similarity', () => {
  it('implements the individual similarity measures', () => {
    expect(ngramJaccard('abcd', 'abce', 2)).toBeCloseTo(0.5);
    expect(levenshteinSimilarity('kitten', 'sitten')).toBeCloseTo(5 / 6);
    expect(lcsRatio('abcdef', 'abqdef')).toBeCloseTo(5 / 6);
    expect(extensionCompatibility('doc', 'docx')).toBe(0.9);
    expect(extensionCompatibility('docx', 'pdf')).toBe(0.6);
    expect(extensionCompatibility('docx', 'xlsx')).toBe(0.1);
  });

  it('scores likely versions highly and exposes the full score breakdown', () => {
    const left = analyzeFilename('\u5ba2\u6237\u8fc1\u79fb\u65b9\u6848_v1.docx');
    const right = analyzeFilename('\u5ba2\u6237\u8fc1\u79fb\u65b9\u6848_\u6700\u7ec8\u7248_v2.docx');
    const result = calculateFilenameSimilarity(left, right);

    expect(result.score).toBeGreaterThanOrEqual(0.78);
    expect(result.breakdown.coreNameExactMatch).toBe(true);
    expect(result.breakdown.extensionCompatibility).toBe(1);
  });

  it('does not score unrelated generic filenames highly', () => {
    const left = analyzeFilename('\u9879\u76ee\u65b9\u6848_\u6700\u7ec8\u7248.docx');
    const right = analyzeFilename('\u9879\u76ee\u62a5\u544a_\u6700\u7ec8\u7248.docx');
    const result = calculateFilenameSimilarity(left, right);

    expect(left.coreName).toBe('');
    expect(right.coreName).toBe('');
    expect(result.score).toBeLessThan(0.2);
    expect(result.breakdown.coreNameExactMatch).toBe(false);
  });
});
