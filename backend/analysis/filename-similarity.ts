import type {
  FilenameAnalysis,
  FilenameSimilarity,
} from '../contracts/filename-analysis';

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function ngrams(value: string, size: number): Set<string> {
  const compact = value.replace(/\s+/g, '');
  const values = new Set<string>();
  for (let index = 0; index <= compact.length - size; index += 1) {
    values.add(compact.slice(index, index + size));
  }
  return values;
}

export function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export function ngramJaccard(left: string, right: string, size: number): number {
  return jaccardSimilarity(ngrams(left, size), ngrams(right, size));
}

export function levenshteinSimilarity(left: string, right: string): number {
  if (left === right) return left.length > 0 ? 1 : 0;
  if (!left || !right) return 0;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

export function lcsRatio(left: string, right: string): number {
  if (!left || !right) return 0;
  let previous = Array<number>(right.length + 1).fill(0);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = Array<number>(right.length + 1).fill(0);
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] =
        left[leftIndex - 1] === right[rightIndex - 1]
          ? previous[rightIndex - 1] + 1
          : Math.max(previous[rightIndex], current[rightIndex - 1]);
    }
    previous = current;
  }
  return previous[right.length] / Math.max(left.length, right.length);
}

const HIGH_COMPATIBILITY = [
  ['doc', 'docx'],
  ['xls', 'xlsx'],
  ['ppt', 'pptx'],
  ['jpg', 'jpeg'],
];
const MEDIUM_COMPATIBILITY = [
  ['docx', 'pdf'],
  ['pptx', 'pdf'],
  ['xlsx', 'csv'],
];

function matchesPair(left: string, right: string, pairs: string[][]): boolean {
  return pairs.some((pair) => pair.includes(left) && pair.includes(right));
}

export function extensionCompatibility(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (matchesPair(left, right, HIGH_COMPATIBILITY)) return 0.9;
  if (matchesPair(left, right, MEDIUM_COMPATIBILITY)) return 0.6;
  return 0.1;
}

export function calculateFilenameSimilarity(
  left: FilenameAnalysis,
  right: FilenameAnalysis,
): FilenameSimilarity {
  const coreNameExactMatch = left.coreName.length > 0 && left.coreName === right.coreName;
  const breakdown = {
    bigramSimilarity: ngramJaccard(left.coreName, right.coreName, 2),
    trigramSimilarity: ngramJaccard(left.coreName, right.coreName, 3),
    tokenJaccard: jaccardSimilarity(
      new Set(left.semanticTokens),
      new Set(right.semanticTokens),
    ),
    levenshteinSimilarity: levenshteinSimilarity(left.coreName, right.coreName),
    lcsRatio: lcsRatio(left.coreName, right.coreName),
    extensionCompatibility: extensionCompatibility(left.extension, right.extension),
    coreNameExactMatch,
  };
  const weightedScore =
    0.3 * breakdown.bigramSimilarity +
    0.2 * breakdown.trigramSimilarity +
    0.2 * breakdown.tokenJaccard +
    0.15 * breakdown.levenshteinSimilarity +
    0.1 * breakdown.lcsRatio +
    0.05 * breakdown.extensionCompatibility +
    (coreNameExactMatch ? 0.08 : 0);

  return { score: clamp(weightedScore), breakdown };
}
