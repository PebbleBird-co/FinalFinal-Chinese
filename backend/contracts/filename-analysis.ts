export type VersionTokenCategory =
  | 'draft'
  | 'revision'
  | 'new'
  | 'final'
  | 'submitted'
  | 'backup'
  | 'copy'
  | 'temporary'
  | 'numeric';

export interface VersionToken {
  raw: string;
  normalized: string;
  category: VersionTokenCategory;
  weight: number;
  position: number;
}

export interface DateToken {
  raw: string;
  normalized: string;
  confidence: 'high' | 'low';
  position: number;
}

export interface FilenameAnalysis {
  originalName: string;
  stem: string;
  extension: string;
  normalizedName: string;
  coreName: string;
  semanticTokens: string[];
  versionTokens: VersionToken[];
  dateTokens: DateToken[];
  numericVersion?: number[];
}

export interface SimilarityBreakdown {
  bigramSimilarity: number;
  trigramSimilarity: number;
  tokenJaccard: number;
  levenshteinSimilarity: number;
  lcsRatio: number;
  extensionCompatibility: number;
  coreNameExactMatch: boolean;
}

export interface FilenameSimilarity {
  score: number;
  breakdown: SimilarityBreakdown;
}
