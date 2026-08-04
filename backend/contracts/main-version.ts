export type MainVersionPenaltyType =
  | 'backup_marker'
  | 'copy_marker'
  | 'temporary_marker'
  | 'has_successor'
  | 'revived_branch'
  | 'timeline_conflict'
  | 'isolated_file';

export interface MainVersionScoreBreakdown {
  recencyScore: number;
  graphLeafScore: number;
  versionMarkerScore: number;
  directoryIntentScore: number;
  branchCentralityScore: number;
  sizePlausibilityScore: number;
  userConfirmationScore: number;
}

export interface MainVersionPenalty {
  type: MainVersionPenaltyType;
  value: number;
  description: string;
}

export interface MainVersionEvidence {
  type: keyof MainVersionScoreBreakdown | MainVersionPenaltyType | 'risk_link';
  description: string;
  value?: number | string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface MainVersionCandidate {
  fileId: string;
  familyId: string;
  score: number;
  confidence: number;
  confidenceText: string;
  rank: number;
  recommended: boolean;
  scoreBreakdown: MainVersionScoreBreakdown;
  penalties: MainVersionPenalty[];
  evidence: MainVersionEvidence[];
  warnings: string[];
}

export interface MainVersionRanking {
  candidates: MainVersionCandidate[];
  disclaimer: string;
}
