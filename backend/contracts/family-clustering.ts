import type { SimilarityBreakdown } from './filename-analysis';

export const FAMILY_THRESHOLDS = Object.freeze({
  strong: 0.78,
  weak: 0.65,
});

export type CandidateReason =
  | 'exact_core_name'
  | 'shared_business_tokens'
  | 'similar_prefix'
  | 'similar_suffix'
  | 'same_directory_near_core'
  | 'shared_name_ngram';

export type FamilyRelationStrength = 'strong' | 'weak';

export type FamilyEvidenceType =
  | 'name_similarity'
  | 'extension_compatibility'
  | 'size_continuity'
  | 'directory_relation'
  | 'version_marker'
  | 'conflict';

export interface FamilyEvidence {
  type: FamilyEvidenceType;
  description: string;
  value?: number | string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface CandidatePair {
  leftFileId: string;
  rightFileId: string;
  reasons: CandidateReason[];
}

export interface FamilyRelation {
  id: string;
  leftFileId: string;
  rightFileId: string;
  strength: FamilyRelationStrength;
  similarity: number;
  baseSimilarity: number;
  scoreBreakdown: SimilarityBreakdown;
  evidence: FamilyEvidence[];
}

export interface FileFamily {
  id: string;
  displayName: string;
  coreName: string;
  fileIds: string[];
  confidence: number;
  evidence: FamilyEvidence[];
}

export interface FamilyClusteringResult {
  families: FileFamily[];
  strongRelations: FamilyRelation[];
  weakRelations: FamilyRelation[];
  candidatePairCount: number;
  totalPossiblePairCount: number;
}
