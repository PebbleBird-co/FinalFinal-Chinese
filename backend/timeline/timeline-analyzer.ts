import type { FamilyClusteringResult } from '../contracts/family-clustering';
import type { RawFileMetadata } from '../contracts/scan';
import type { TimelineRiskAnalysis } from '../contracts/timeline-risk';
import type { SerializedVersionGraph } from '../contracts/version-graph';
import { detectProjectRisks } from '../risks/risk-detector';
import { aggregateDailyActivity } from './activity-aggregator';
import {
  detectActivityPeaks,
  detectBranchEvents,
  detectDirectionShift,
  detectFinalBursts,
  detectProjectStart,
  detectRevivedBranches,
} from './event-detector';

export function analyzeTimelineAndRisks(
  files: RawFileMetadata[],
  clustering: FamilyClusteringResult,
  graph: SerializedVersionGraph,
): TimelineRiskAnalysis {
  const dailyActivity = aggregateDailyActivity(files, clustering.families);
  const projectStart = detectProjectStart(files, clustering.families);
  const events = [
    ...(projectStart ? [projectStart] : []),
    ...detectActivityPeaks(dailyActivity, files, clustering.families),
    ...detectBranchEvents(files, graph),
    ...detectDirectionShift(files, clustering.families),
    ...detectRevivedBranches(files, clustering.families),
    ...detectFinalBursts(files, clustering.families),
  ].sort((left, right) => left.startAt.localeCompare(right.startAt));
  return {
    dailyActivity,
    events,
    risks: detectProjectRisks(files, clustering, graph, events),
  };
}
