// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type { ScanResult } from '../contracts/scan';
import { buildReportHtml, safeReportFilename } from '../report/report-template';

function reportResult(): ScanResult {
  return {
    scanId: 'scan-pdf',
    rootPath: 'C:\\Projects\\策划案<script>',
    scannedAt: '2026-06-03T10:00:00.000Z',
    completedAt: '2026-06-03T10:00:01.000Z',
    status: 'completed',
    limits: { maxFiles: 20_000, maxDepth: 20 },
    files: [{
      id: 'file-final',
      name: '策划案_提交版<img>.docx',
      extension: 'docx',
      absolutePath: 'C:\\Projects\\策划案\\策划案_提交版.docx',
      relativePath: '策划案_提交版.docx',
      parentDirectory: '.',
      directoryDepth: 0,
      size: 4096,
      modifiedAt: '2026-06-03T09:00:00.000Z',
      analysis: {
        originalName: '策划案_提交版.docx',
        stem: '策划案_提交版',
        extension: 'docx',
        normalizedName: '策划案 提交版',
        coreName: '策划案',
        semanticTokens: ['策划案'],
        versionTokens: [{ raw: '提交版', normalized: '提交', category: 'submitted', weight: 0.8, position: 4 }],
        dateTokens: [],
      },
    }],
    clustering: {
      families: [{ id: 'family-1', displayName: '策划案', coreName: '策划案', fileIds: ['file-final'], confidence: 1, evidence: [] }],
      strongRelations: [],
      weakRelations: [],
      candidatePairCount: 0,
      totalPossiblePairCount: 0,
    },
    versionGraph: {
      schemaVersion: '1.0',
      nodes: [],
      edges: [],
      rootFileIds: ['file-final'],
      leafFileIds: ['file-final'],
      branchPointFileIds: [],
    },
    timeline: {
      dailyActivity: [{ date: '2026-06-03', fileCount: 1, createdFileCount: 0, modifiedFileCount: 1, activeFamilyCount: 1, finalMarkerCount: 1 }],
      events: [{ id: 'event-start', type: 'project_start', startAt: '2026-06-03T09:00:00.000Z', title: '可能的项目起点', description: '最早一批文件活动出现在此时。', confidence: 0.72, relatedFileIds: ['file-final'], relatedFamilyIds: ['family-1'], evidence: [{ type: 'time_range', description: '当前最早的修改时间', value: '2026-06-03', impact: 'neutral' }] }],
      risks: [{ id: 'risk-final', type: 'multiple_final_versions', severity: 'high', title: '可能存在多个正式版本', description: '检测到需要人工核对的最终标记。', confidence: 0.76, relatedFileIds: ['file-final'], relatedFamilyIds: ['family-1'], evidence: [{ type: 'version_marker', description: '文件名包含提交标记', impact: 'neutral' }], recommendation: '核对交付记录与实际接收版本。' }],
    },
    mainVersions: {
      candidates: [{ fileId: 'file-final', familyId: 'family-1', score: 0.82, confidence: 0.8, confidenceText: '较可能', rank: 1, recommended: true, scoreBreakdown: { recencyScore: 1, graphLeafScore: 1, versionMarkerScore: 0.8, directoryIntentScore: 0.5, branchCentralityScore: 0.5, sizePlausibilityScore: 1, userConfirmationScore: 0 }, penalties: [], evidence: [{ type: 'recencyScore', description: '属于最近活跃文件', value: 1, impact: 'positive' }, { type: 'graphLeafScore', description: '位于推测关系图的叶节点', value: 1, impact: 'positive' }, { type: 'versionMarkerScore', description: '文件名包含提交标记', value: 0.8, impact: 'positive' }], warnings: [] }],
      disclaimer: '文件名中的“最终”“定稿”或“提交”只作为弱证据。',
    },
    warnings: [],
  };
}

describe('print report template', () => {
  it('contains every required report section and the human-confirmation disclaimer', () => {
    const html = buildReportHtml({ result: reportResult(), overrideCount: 2 }, '2026-06-03T10:05:00.000Z');

    expect(html).toContain('项目摘要');
    expect(html).toContain('正式版本候选');
    expect(html).toContain('项目时间线');
    expect(html).toContain('风险线索');
    expect(html).toContain('文件家族摘要');
    expect(html).toContain('推断限制说明');
    expect(html).toContain('推断结果仅供人工确认');
    expect(html).toContain('用户纠正 2 条');
  });

  it('escapes metadata before inserting it into HTML and sanitizes the suggested filename', () => {
    const result = reportResult();
    const html = buildReportHtml({ result, overrideCount: 0 });

    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img>.docx');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img&gt;.docx');
    expect(safeReportFilename('C:\\bad<>:"/name\u0000')).toBe('name--文件考古报告.pdf');
  });

  it('states when a large family list is bounded for print readability', () => {
    const result = reportResult();
    result.clustering.families = Array.from({ length: 105 }, (_, index) => ({
      id: `family-${index}`,
      displayName: `家族 ${index}`,
      coreName: `家族 ${index}`,
      fileIds: [`file-${index}`],
      confidence: 1,
      evidence: [],
    }));

    const html = buildReportHtml({ result, overrideCount: 0 });
    expect(html).toContain('其余 5 个家族未在打印版中展开');
  });
});
