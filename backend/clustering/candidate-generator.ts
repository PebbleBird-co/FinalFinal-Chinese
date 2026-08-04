import type { RawFileMetadata } from '../contracts/scan';
import type { CandidatePair, CandidateReason } from '../contracts/family-clustering';

const WINDOW_SIZE = 8;

function compact(value: string): string {
  return value.replace(/\s+/g, '');
}

function pairKey(leftId: string, rightId: string): string {
  return leftId < rightId ? `${leftId}\u0000${rightId}` : `${rightId}\u0000${leftId}`;
}

function addToBucket(buckets: Map<string, RawFileMetadata[]>, key: string, file: RawFileMetadata) {
  if (!key) return;
  const bucket = buckets.get(key) ?? [];
  bucket.push(file);
  buckets.set(key, bucket);
}

function characterNgrams(value: string, size: number): string[] {
  const normalized = compact(value);
  const grams = new Set<string>();
  for (let index = 0; index <= normalized.length - size; index += 1) {
    grams.add(normalized.slice(index, index + size));
  }
  return [...grams];
}

export function generateCandidatePairs(files: RawFileMetadata[]): CandidatePair[] {
  const pairReasons = new Map<string, Set<CandidateReason>>();
  const fileById = new Map(files.map((file) => [file.id, file]));

  const addPair = (left: RawFileMetadata, right: RawFileMetadata, reason: CandidateReason) => {
    if (left.id === right.id) return;
    const key = pairKey(left.id, right.id);
    const reasons = pairReasons.get(key) ?? new Set<CandidateReason>();
    reasons.add(reason);
    pairReasons.set(key, reasons);
  };

  const exactCoreBuckets = new Map<string, RawFileMetadata[]>();
  const prefixBuckets = new Map<string, RawFileMetadata[]>();
  const suffixBuckets = new Map<string, RawFileMetadata[]>();
  const tokenPairBuckets = new Map<string, RawFileMetadata[]>();
  const directoryBuckets = new Map<string, RawFileMetadata[]>();
  const ngramBuckets = new Map<string, RawFileMetadata[]>();

  for (const file of files) {
    const coreName = compact(file.analysis.coreName);
    if (!coreName) continue;
    addToBucket(exactCoreBuckets, coreName, file);
    if (coreName.length >= 3) {
      addToBucket(prefixBuckets, coreName.slice(0, 3), file);
      addToBucket(suffixBuckets, coreName.slice(-3), file);
    }
    addToBucket(directoryBuckets, `${file.parentDirectory}\u0000${coreName.slice(0, 2)}`, file);
    for (const gram of characterNgrams(coreName, 2)) addToBucket(ngramBuckets, gram, file);

    const tokens = [...new Set(file.analysis.semanticTokens)].sort();
    for (let left = 0; left < tokens.length; left += 1) {
      for (let right = left + 1; right < tokens.length; right += 1) {
        addToBucket(tokenPairBuckets, `${tokens[left]}\u0000${tokens[right]}`, file);
      }
    }
  }

  for (const bucket of exactCoreBuckets.values()) {
    if (bucket.length < 2) continue;
    const sorted = bucket.sort((left, right) => left.id.localeCompare(right.id));
    for (let index = 1; index < sorted.length; index += 1) {
      addPair(sorted[0], sorted[index], 'exact_core_name');
    }
  }

  const addWindowedPairs = (
    buckets: Map<string, RawFileMetadata[]>,
    reason: CandidateReason,
  ) => {
    for (const bucket of buckets.values()) {
      if (bucket.length < 2) continue;
      const sorted = [...bucket].sort((left, right) =>
        left.analysis.normalizedName.localeCompare(right.analysis.normalizedName),
      );
      for (let left = 0; left < sorted.length; left += 1) {
        const end = Math.min(sorted.length, left + WINDOW_SIZE + 1);
        for (let right = left + 1; right < end; right += 1) {
          addPair(sorted[left], sorted[right], reason);
        }
      }
    }
  };

  addWindowedPairs(tokenPairBuckets, 'shared_business_tokens');
  addWindowedPairs(prefixBuckets, 'similar_prefix');
  addWindowedPairs(suffixBuckets, 'similar_suffix');
  addWindowedPairs(directoryBuckets, 'same_directory_near_core');
  addWindowedPairs(ngramBuckets, 'shared_name_ngram');

  return [...pairReasons.entries()]
    .map(([key, reasons]) => {
      const [leftFileId, rightFileId] = key.split('\u0000');
      if (!fileById.has(leftFileId) || !fileById.has(rightFileId)) {
        throw new Error('Candidate pair references an unknown file.');
      }
      return { leftFileId, rightFileId, reasons: [...reasons].sort() };
    })
    .sort((left, right) =>
      `${left.leftFileId}\u0000${left.rightFileId}`.localeCompare(
        `${right.leftFileId}\u0000${right.rightFileId}`,
      ),
    );
}
