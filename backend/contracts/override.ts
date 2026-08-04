import type { ScanResult } from './scan';

export type UserOverrideType =
  | 'set_main_version'
  | 'mark_abandoned'
  | 'mark_as_copy'
  | 'set_parent'
  | 'remove_edge'
  | 'merge_families'
  | 'split_family';

export interface UserOverride {
  id: string;
  type: UserOverrideType;
  targetIds: string[];
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface OverrideHistory {
  past: UserOverride[][];
  present: UserOverride[];
  future: UserOverride[][];
}

export interface AnalyzeProjectInput {
  baseResult: ScanResult;
  overrides: UserOverride[];
}

export interface PersistedProjectState {
  schemaVersion: '1.0';
  baseResult: ScanResult;
  result: ScanResult;
  history: OverrideHistory;
  savedAt: string;
}
