import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { AlertTriangle, CalendarRange } from 'lucide-react';
import { EvidenceList } from '@/components/report/EvidenceList';
import type {
  ProjectRisk,
  TimelineRiskAnalysis,
} from '../../../../backend/contracts/timeline-risk';

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const COPY = {
  timeline: '\u9879\u76ee\u6d3b\u52a8\u65f6\u95f4\u7ebf',
  timelineDescription: '\u4ec5\u4f9d\u636e\u6587\u4ef6\u65f6\u95f4\u5143\u6570\u636e\u751f\u6210\uff0c\u590d\u5236\u6216\u6062\u590d\u6587\u4ef6\u53ef\u80fd\u5bfc\u81f4\u65f6\u95f4\u5931\u771f\u3002',
  fileActivity: '\u6587\u4ef6\u6d3b\u52a8',
  activeFamilies: '\u6d3b\u8dc3\u5bb6\u65cf',
  events: '\u63a8\u6d4b\u4e8b\u4ef6',
  evidence: '\u9879\u4f9d\u636e',
  risks: '\u9700\u8981\u4eba\u5de5\u786e\u8ba4\u7684\u98ce\u9669',
  risksDescription: '\u98ce\u9669\u662f\u89c4\u5219\u547d\u4e2d\u7684\u5f85\u786e\u8ba4\u7ebf\u7d22\uff0c\u4e0d\u8868\u793a\u5df2\u7ecf\u53d1\u751f\u8bef\u64cd\u4f5c\u3002',
  confidence: '\u7f6e\u4fe1\u5ea6',
  noRisks: '\u5f53\u524d\u89c4\u5219\u6ca1\u6709\u53d1\u73b0\u9700\u8981\u4f18\u5148\u786e\u8ba4\u7684\u98ce\u9669\u3002',
} as const;

const SEVERITY_LABEL = {
  low: '\u4f4e',
  medium: '\u4e2d',
  high: '\u9ad8',
} as const;

const SEVERITY_CLASS = {
  low: 'border-[#cadbcf] bg-[#f4faf6] text-[#376149]',
  medium: 'border-[#e8d6ad] bg-[#fffaf0] text-[#805c20]',
  high: 'border-[#e8c6bd] bg-[#fff6f3] text-[#823f32]',
} as const;

export function TimelineRiskPanel({ analysis }: { analysis: TimelineRiskAnalysis }) {
  return (
    <>
      <TimelineSection analysis={analysis} />
      <RiskSection risks={analysis.risks} />
    </>
  );
}

export default TimelineRiskPanel;

export function TimelineSection({ analysis }: { analysis: TimelineRiskAnalysis }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current, undefined, { renderer: 'canvas' });
    const maximumActivity = Math.max(
      ...analysis.dailyActivity.map((day) => day.fileCount),
      1,
    );
    const eventData = analysis.events.map((item) => [
      item.startAt.slice(0, 10),
      maximumActivity * 1.12,
      item.title,
    ]);
    chart.setOption({
      animationDuration: 350,
      color: ['#315d73', '#9a7436', '#a35142'],
      grid: { left: 42, right: 28, top: 48, bottom: 58 },
      legend: {
        top: 8,
        left: 8,
        textStyle: { color: '#56636c', fontSize: 12 },
      },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: analysis.dailyActivity.map((day) => day.date),
        axisLabel: { color: '#69757d', hideOverlap: true },
        axisLine: { lineStyle: { color: '#d7dee2' } },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#69757d' },
        splitLine: { lineStyle: { color: '#edf0f2' } },
      },
      dataZoom: [
        { type: 'inside', filterMode: 'none' },
        { type: 'slider', height: 18, bottom: 12, borderColor: '#d7dee2', fillerColor: 'rgba(49,93,115,0.12)' },
      ],
      series: [
        {
          name: COPY.fileActivity,
          type: 'bar',
          barMaxWidth: 26,
          data: analysis.dailyActivity.map((day) => day.fileCount),
          itemStyle: { borderRadius: [3, 3, 0, 0] },
        },
        {
          name: COPY.activeFamilies,
          type: 'line',
          smooth: false,
          symbolSize: 6,
          data: analysis.dailyActivity.map((day) => day.activeFamilyCount),
        },
        {
          name: COPY.events,
          type: 'scatter',
          symbol: 'diamond',
          symbolSize: 9,
          data: eventData,
          tooltip: {
            formatter: (params: { value?: unknown[] }) =>
              Array.isArray(params.value) ? String(params.value[2] ?? COPY.events) : COPY.events,
          },
        },
      ],
    });

    const resize = () => chart.resize();
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
    observer?.observe(chartRef.current);
    window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [analysis]);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="flex flex-col justify-between gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <CalendarRange aria-hidden="true" className="text-primary" size={18} />
            <h2 className="font-semibold">{COPY.timeline}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{COPY.timelineDescription}</p>
        </div>
        <span className="text-sm text-muted-foreground">
          <strong className="text-foreground">{analysis.events.length}</strong> {COPY.events}
        </span>
      </div>
      <div ref={chartRef} className="h-[360px] w-full bg-[#fbfcfc]" aria-label={COPY.timeline} />
      {analysis.events.length > 0 ? (
        <div className="divide-y divide-border border-t border-border">
          {analysis.events.map((item) => (
            <div className="grid gap-2 px-5 py-4 md:grid-cols-[130px_minmax(0,1fr)_110px]" key={item.id}>
              <time className="text-sm font-medium">{item.startAt.slice(0, 10)}</time>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                <EvidenceList evidence={item.evidence} label="展开事件证据" />
              </div>
              <p className="text-xs text-muted-foreground md:text-right">
                {Math.round(item.confidence * 100)}% · {item.evidence.length} {COPY.evidence}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RiskSection({ risks }: { risks: ProjectRisk[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="text-[#9a6527]" size={18} />
          <h2 className="font-semibold">{COPY.risks}</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{COPY.risksDescription}</p>
      </div>
      {risks.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{COPY.noRisks}</p>
      ) : (
        <div className="divide-y divide-border">
          {risks.map((item) => (
            <article className="grid gap-4 px-5 py-5 lg:grid-cols-[110px_minmax(0,1fr)_260px]" key={item.id}>
              <div>
                <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${SEVERITY_CLASS[item.severity]}`}>
                  {SEVERITY_LABEL[item.severity]}
                </span>
                <p className="mt-2 text-xs text-muted-foreground">
                  {COPY.confidence} {Math.round(item.confidence * 100)}%
                </p>
              </div>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.evidence.length} {COPY.evidence} · {item.relatedFileIds.length} 文件
                </p>
              </div>
              <p className="border-l-2 border-[#e8dcc5] pl-4 text-sm leading-6 text-[#675638]">
                {item.recommendation}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
