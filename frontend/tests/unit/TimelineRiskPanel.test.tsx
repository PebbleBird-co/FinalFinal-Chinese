import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const chartMocks = vi.hoisted(() => ({
  dispose: vi.fn(),
  init: vi.fn(),
  resize: vi.fn(),
  setOption: vi.fn(),
  use: vi.fn(),
}));

chartMocks.init.mockReturnValue({
  dispose: chartMocks.dispose,
  resize: chartMocks.resize,
  setOption: chartMocks.setOption,
});

vi.mock('echarts/core', () => ({ init: chartMocks.init, use: chartMocks.use }));
vi.mock('echarts/charts', () => ({ BarChart: {}, LineChart: {}, ScatterChart: {} }));
vi.mock('echarts/components', () => ({
  DataZoomComponent: {},
  GridComponent: {},
  LegendComponent: {},
  TooltipComponent: {},
}));
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }));

import { TimelineRiskPanel } from '@/components/timeline/TimelineRiskPanel';
import type { TimelineRiskAnalysis } from '../../../backend/contracts/timeline-risk';

const analysis: TimelineRiskAnalysis = {
  dailyActivity: [
    { date: '2026-05-12', fileCount: 4, createdFileCount: 1, modifiedFileCount: 4, activeFamilyCount: 2, finalMarkerCount: 1 },
  ],
  events: [
    {
      id: 'event:start',
      type: 'project_start',
      startAt: '2026-05-12T08:00:00.000Z',
      title: '\u53ef\u80fd\u7684\u9879\u76ee\u6d3b\u8dc3\u8d77\u70b9',
      description: '\u73b0\u6709\u5143\u6570\u636e\u663e\u793a\u7684\u63a8\u6d4b\u7ed3\u679c\u3002',
      confidence: 0.72,
      relatedFileIds: ['file:a'],
      relatedFamilyIds: ['family:a'],
      evidence: [{ type: 'time_range', description: 'range', value: 1, impact: 'positive' }],
    },
  ],
  risks: [
    {
      id: 'risk:final',
      type: 'multiple_final_versions',
      severity: 'medium',
      title: '\u5b58\u5728\u591a\u4e2a\u6700\u7ec8\u7248\u5019\u9009',
      description: '\u540c\u4e00\u5bb6\u65cf\u4e2d\u51fa\u73b0\u591a\u4e2a\u6700\u7ec8\u6807\u8bb0\u3002',
      confidence: 0.84,
      relatedFileIds: ['file:a', 'file:b'],
      relatedFamilyIds: ['family:a'],
      evidence: [{ type: 'version_marker', description: 'markers', value: 2, impact: 'negative' }],
      recommendation: '\u8bf7\u4eba\u5de5\u786e\u8ba4\u4ea4\u4ed8\u5bf9\u8c61\u3002',
    },
  ],
};

describe('timeline and risk panel', () => {
  it('initializes the chart and presents evidence-backed events and risks', () => {
    render(<TimelineRiskPanel analysis={analysis} />);

    expect(chartMocks.init).toHaveBeenCalledOnce();
    expect(chartMocks.setOption).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: '\u9879\u76ee\u6d3b\u52a8\u65f6\u95f4\u7ebf' })).toBeInTheDocument();
    expect(screen.getByText('\u53ef\u80fd\u7684\u9879\u76ee\u6d3b\u8dc3\u8d77\u70b9')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '\u5b58\u5728\u591a\u4e2a\u6700\u7ec8\u7248\u5019\u9009' })).toBeInTheDocument();
    expect(screen.getByText('\u8bf7\u4eba\u5de5\u786e\u8ba4\u4ea4\u4ed8\u5bf9\u8c61\u3002')).toBeInTheDocument();
  });
});
