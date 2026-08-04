import { extname } from 'node:path';
import type {
  DateToken,
  FilenameAnalysis,
  VersionToken,
} from '../contracts/filename-analysis';
import { GENERIC_STOP_WORDS, VERSION_DICTIONARY } from './token-dictionaries';

interface NumericMatch {
  raw: string;
  value: number[];
  position: number;
}

const DATE_PATTERNS: Array<{
  expression: RegExp;
  confidence: DateToken['confidence'];
  normalize: (match: RegExpExecArray) => string | undefined;
}> = [
  {
    expression: /(?<!\d)(\d{4})[-.]([01]?\d)[-.]([0-3]?\d)(?!\d)/g,
    confidence: 'high',
    normalize: (match) => validDate(match[1], match[2], match[3]),
  },
  {
    expression: /(?<!\d)(\d{4})([01]\d)([0-3]\d)(?!\d)/g,
    confidence: 'high',
    normalize: (match) => validDate(match[1], match[2], match[3]),
  },
  {
    expression: /(?<!\d)(\d{4})年([01]?\d)月([0-3]?\d)日?/g,
    confidence: 'high',
    normalize: (match) => validDate(match[1], match[2], match[3]),
  },
  {
    expression: /(?<!\d)([01]?\d)月([0-3]?\d)日?/g,
    confidence: 'low',
    normalize: (match) => validShortDate(match[1], match[2]),
  },
  {
    expression: /(?<![a-z0-9])([01]\d)([0-3]\d)(?!\d)/g,
    confidence: 'low',
    normalize: (match) => validShortDate(match[1], match[2]),
  },
];

const NUMERIC_VERSION_PATTERNS = [
  /(?<![a-z0-9])v(?:ersion)?[\s._-]*(\d{1,3}(?:[._-]\d{1,3}){0,2})(?!\d)/g,
  /(?<![a-z0-9])rev(?:ision)?[\s._-]*(\d{1,3}(?:[._-]\d{1,3}){0,2})(?!\d)/g,
  /(?<![a-z0-9])r[\s._-]*(\d{1,3}(?:[._-]\d{1,3}){0,2})(?!\d)/g,
  /版本\s*(\d{1,3}(?:[._-]\d{1,3}){0,2})/g,
  /第\s*(\d{1,3}(?:[._-]\d{1,3}){0,2})\s*版/g,
];

function validDate(yearText: string, monthText: string, dayText: string): string | undefined {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return undefined;
  }
  return `${yearText.padStart(4, '0')}-${monthText.padStart(2, '0')}-${dayText.padStart(2, '0')}`;
}

function validShortDate(monthText: string, dayText: string): string | undefined {
  const month = Number(monthText);
  const day = Number(dayText);
  const value = new Date(Date.UTC(2000, month - 1, day));
  if (value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return undefined;
  return `${monthText.padStart(2, '0')}-${dayText.padStart(2, '0')}`;
}

function removeExtension(name: string): { stem: string; extension: string } {
  const extensionWithDot = extname(name);
  if (!extensionWithDot || extensionWithDot === name) return { stem: name, extension: '' };
  return {
    stem: name.slice(0, -extensionWithDot.length),
    extension: extensionWithDot.slice(1).toLowerCase(),
  };
}

function normalizeSeparators(value: string): string {
  return value
    .replace(/[()（）[\]【】{}]/g, ' ')
    .replace(/[\s_\-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDates(value: string): DateToken[] {
  const tokens: DateToken[] = [];
  const occupied = new Set<number>();
  for (const pattern of DATE_PATTERNS) {
    pattern.expression.lastIndex = 0;
    for (const match of value.matchAll(pattern.expression)) {
      const position = match.index;
      const normalized = pattern.normalize(match);
      if (!normalized) continue;
      const indexes = Array.from({ length: match[0].length }, (_, index) => position + index);
      if (indexes.some((index) => occupied.has(index))) continue;
      indexes.forEach((index) => occupied.add(index));
      tokens.push({ raw: match[0], normalized, confidence: pattern.confidence, position });
    }
  }
  return tokens.sort((left, right) => left.position - right.position);
}

function extractNumericVersions(value: string): NumericMatch[] {
  const matches: NumericMatch[] = [];
  const occupied = new Set<number>();
  for (const expression of NUMERIC_VERSION_PATTERNS) {
    expression.lastIndex = 0;
    for (const match of value.matchAll(expression)) {
      const position = match.index;
      const indexes = Array.from({ length: match[0].length }, (_, index) => position + index);
      if (indexes.some((index) => occupied.has(index))) continue;
      indexes.forEach((index) => occupied.add(index));
      matches.push({
        raw: match[0],
        value: match[1].split(/[._-]/).map(Number),
        position,
      });
    }
  }
  return matches.sort((left, right) => left.position - right.position);
}

function isAsciiWord(value: string): boolean {
  return /^[a-z]+$/i.test(value);
}

function extractVersionTokens(value: string, numericMatches: NumericMatch[]): VersionToken[] {
  const tokens: VersionToken[] = numericMatches.map((match) => ({
    raw: match.raw,
    normalized: match.value.join('.'),
    category: 'numeric',
    weight: 0.65,
    position: match.position,
  }));
  const occupied = new Set<number>();

  for (const entry of VERSION_DICTIONARY) {
    let fromIndex = 0;
    while (fromIndex < value.length) {
      const position = value.indexOf(entry.term, fromIndex);
      if (position < 0) break;
      fromIndex = position + entry.term.length;
      const before = value[position - 1] ?? '';
      const after = value[position + entry.term.length] ?? '';
      if (isAsciiWord(entry.term) && (/[a-z0-9]/i.test(before) || /[a-z0-9]/i.test(after))) continue;
      if (entry.term.length === 1 && /[\u3400-\u9fff]/u.test(before) && /[\u3400-\u9fff]/u.test(after)) {
        continue;
      }
      const indexes = Array.from({ length: entry.term.length }, (_, index) => position + index);
      if (indexes.some((index) => occupied.has(index))) continue;
      indexes.forEach((index) => occupied.add(index));
      tokens.push({
        raw: value.slice(position, position + entry.term.length),
        normalized: entry.normalized,
        category: entry.category,
        weight: entry.weight,
        position,
      });
    }
  }
  return tokens.sort((left, right) => left.position - right.position);
}

function removeLiteral(value: string, literal: string): string {
  return value.split(literal).join(' ');
}

function buildCoreName(
  lowerStem: string,
  dateTokens: DateToken[],
  versionTokens: VersionToken[],
): { coreName: string; semanticTokens: string[] } {
  let core = lowerStem;
  for (const token of [...dateTokens, ...versionTokens].sort((a, b) => b.raw.length - a.raw.length)) {
    core = removeLiteral(core, token.raw.normalize('NFKC').toLowerCase());
  }
  for (const stopWord of GENERIC_STOP_WORDS) {
    if (stopWord.length > 1) core = removeLiteral(core, stopWord);
  }
  core = normalizeSeparators(core).replace(/^[.]+|[.]+$/g, '').trim();
  const semanticTokens = core
    .split(/[\s.]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  return { coreName: semanticTokens.join(' '), semanticTokens: [...new Set(semanticTokens)] };
}

export function analyzeFilename(originalName: string): FilenameAnalysis {
  const normalizedOriginal = originalName.normalize('NFKC');
  const { stem, extension } = removeExtension(normalizedOriginal);
  const lowerStem = stem.toLowerCase();
  const normalizedName = normalizeSeparators(lowerStem);
  const dateTokens = extractDates(lowerStem);
  const numericMatches = extractNumericVersions(lowerStem);
  const versionTokens = extractVersionTokens(lowerStem, numericMatches);
  const { coreName, semanticTokens } = buildCoreName(lowerStem, dateTokens, versionTokens);

  return {
    originalName,
    stem,
    extension,
    normalizedName,
    coreName,
    semanticTokens,
    versionTokens,
    dateTokens,
    ...(numericMatches[0] ? { numericVersion: numericMatches[0].value } : {}),
  };
}
