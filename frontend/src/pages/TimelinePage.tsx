import { lazy, Suspense } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ScanResult } from '../../../backend/contracts/scan';
import { ReportLoadingState } from '@/components/report/ReportStates';

const TimelineSection = lazy(() =>
  import('@/components/timeline/TimelineRiskPanel').then((module) => ({
    default: module.TimelineSection,
  })),
);

export function TimelinePage() {
  const result = useOutletContext<ScanResult>();
  return (
    <div>
      <div className="mb-5">
        <p className="text-xs font-semibold text-primary">活动轨迹</p>
        <h2 className="mt-1 text-xl font-semibold">项目时间线</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          图表仅呈现文件时间元数据的聚合与规则推测。复制、恢复或迁移可能造成时间失真。
        </p>
      </div>
      <Suspense fallback={<ReportLoadingState />}>
        <TimelineSection analysis={result.timeline} />
      </Suspense>
    </div>
  );
}
