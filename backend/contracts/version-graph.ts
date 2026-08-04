export type VersionRelation =
  | 'likely_successor'
  | 'possible_successor'
  | 'possible_branch'
  | 'uncertain';

export type ParentEdgeRole = 'main' | 'alternate';

export interface VersionEdgeScoreBreakdown {
  nameSimilarity: number;
  timeOrderScore: number;
  sizeContinuityScore: number;
  directoryRelationScore: number;
  versionProgressionScore: number;
}

export type VersionEvidenceType =
  | 'name_similarity'
  | 'time_order'
  | 'size_continuity'
  | 'directory_relation'
  | 'version_marker'
  | 'conflict';

export interface VersionEvidence {
  type: VersionEvidenceType;
  description: string;
  value?: number | string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface VersionEdge {
  id: string;
  familyId: string;
  sourceFileId: string;
  targetFileId: string;
  role: ParentEdgeRole;
  relation: VersionRelation;
  confidence: number;
  scoreBreakdown: VersionEdgeScoreBreakdown;
  evidence: VersionEvidence[];
  overriddenByUser: boolean;
}

export interface VersionGraphNode {
  id: string;
  fileId: string;
  familyId: string;
  label: string;
  modifiedAt: string;
  position: { x: number; y: number };
  incomingMainEdgeCount: number;
  outgoingMainEdgeCount: number;
}

export interface SerializedVersionGraph {
  schemaVersion: '1.0';
  nodes: VersionGraphNode[];
  edges: VersionEdge[];
  rootFileIds: string[];
  leafFileIds: string[];
  branchPointFileIds: string[];
}
