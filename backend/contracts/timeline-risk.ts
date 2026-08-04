export type ProjectEventType =
  | 'project_start'
  | 'activity_peak'
  | 'branch_created'
  | 'direction_shift'
  | 'old_branch_revived'
  | 'final_version_burst';

export type ProjectRiskType =
  | 'multiple_final_versions'
  | 'revived_old_branch'
  | 'cross_directory_shadow_copy'
  | 'branch_explosion'
  | 'timeline_name_conflict'
  | 'isolated_new_version';

export type RiskSeverity = 'low' | 'medium' | 'high';

export type TimelineEvidenceType =
  | 'activity_count'
  | 'time_range'
  | 'family_activity'
  | 'directory_shift'
  | 'graph_branch'
  | 'version_marker'
  | 'name_similarity'
  | 'graph_position'
  | 'conflict';

export interface TimelineEvidence {
  type: TimelineEvidenceType;
  description: string;
  value?: number | string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface DailyActivity {
  date: string;
  fileCount: number;
  createdFileCount: number;
  modifiedFileCount: number;
  activeFamilyCount: number;
  finalMarkerCount: number;
}

export interface ProjectEvent {
  id: string;
  type: ProjectEventType;
  startAt: string;
  endAt?: string;
  title: string;
  description: string;
  confidence: number;
  relatedFileIds: string[];
  relatedFamilyIds: string[];
  evidence: TimelineEvidence[];
}

export interface ProjectRisk {
  id: string;
  type: ProjectRiskType;
  severity: RiskSeverity;
  title: string;
  description: string;
  confidence: number;
  relatedFileIds: string[];
  relatedFamilyIds: string[];
  evidence: TimelineEvidence[];
  recommendation: string;
}

export interface TimelineRiskAnalysis {
  dailyActivity: DailyActivity[];
  events: ProjectEvent[];
  risks: ProjectRisk[];
}
