import type { ScanResult } from '../../../backend/contracts/scan';

export const reportResult: ScanResult = {
  scanId: 'scan-report',
  rootPath: 'C:\\Projects\\产品策划案',
  scannedAt: '2026-06-03T10:00:00.000Z',
  completedAt: '2026-06-03T10:00:01.000Z',
  status: 'completed',
  limits: { maxFiles: 20_000, maxDepth: 20 },
  files: [
    {
      id: 'file-final',
      name: '产品策划案_提交版.docx',
      extension: 'docx',
      absolutePath: 'C:\\Projects\\产品策划案\\产品策划案_提交版.docx',
      relativePath: '产品策划案_提交版.docx',
      parentDirectory: '.',
      directoryDepth: 0,
      size: 4096,
      modifiedAt: '2026-06-03T09:00:00.000Z',
      analysis: {
        originalName: '产品策划案_提交版.docx',
        stem: '产品策划案_提交版',
        extension: 'docx',
        normalizedName: '产品策划案 提交版',
        coreName: '产品策划案',
        semanticTokens: ['产品', '策划案'],
        versionTokens: [{ raw: '提交版', normalized: '提交', category: 'submitted', weight: 0.8, position: 6 }],
        dateTokens: [],
      },
    },
  ],
  clustering: {
    families: [{ id: 'family-1', displayName: '产品策划案', coreName: '产品策划案', fileIds: ['file-final'], confidence: 1, evidence: [] }],
    strongRelations: [],
    weakRelations: [],
    candidatePairCount: 0,
    totalPossiblePairCount: 0,
  },
  versionGraph: {
    schemaVersion: '1.0',
    nodes: [{ id: 'node:file-final', fileId: 'file-final', familyId: 'family-1', label: '产品策划案_提交版.docx', modifiedAt: '2026-06-03T09:00:00.000Z', position: { x: 0, y: 0 }, incomingMainEdgeCount: 0, outgoingMainEdgeCount: 0 }],
    edges: [],
    rootFileIds: ['file-final'],
    leafFileIds: ['file-final'],
    branchPointFileIds: [],
  },
  timeline: {
    dailyActivity: [{ date: '2026-06-03', fileCount: 1, createdFileCount: 0, modifiedFileCount: 1, activeFamilyCount: 1, finalMarkerCount: 0 }],
    events: [{ id: 'event-start', type: 'project_start', startAt: '2026-06-03T09:00:00.000Z', title: '可能的项目起点', description: '最早一批文件活动出现在此时。', confidence: 0.72, relatedFileIds: ['file-final'], relatedFamilyIds: ['family-1'], evidence: [{ type: 'time_range', description: '当前最早的修改时间', value: '2026-06-03', impact: 'neutral' }] }],
    risks: [{ id: 'risk-final', type: 'multiple_final_versions', severity: 'high', title: '可能存在多个正式版本', description: '检测到需要人工核对的最终标记。', confidence: 0.76, relatedFileIds: ['file-final'], relatedFamilyIds: ['family-1'], evidence: [{ type: 'version_marker', description: '文件名包含提交标记', impact: 'neutral' }], recommendation: '核对交付记录与实际接收版本。' }],
  },
  mainVersions: {
    candidates: [{ fileId: 'file-final', familyId: 'family-1', score: 0.82, confidence: 0.8, confidenceText: '较可能', rank: 1, recommended: true, scoreBreakdown: { recencyScore: 1, graphLeafScore: 1, versionMarkerScore: 0.8, directoryIntentScore: 0.5, branchCentralityScore: 0.5, sizePlausibilityScore: 1, userConfirmationScore: 0 }, penalties: [], evidence: [{ type: 'recencyScore', description: '属于最近活跃文件', value: 1, impact: 'positive' }, { type: 'graphLeafScore', description: '位于推测关系图的叶节点', value: 1, impact: 'positive' }, { type: 'versionMarkerScore', description: '文件名包含提交标记', value: 0.8, impact: 'positive' }], warnings: ['仍需人工核对实际交付记录。'] }],
    disclaimer: '文件名中的“最终”“定稿”或“提交”只作为弱证据，不能单独证明正式版本。',
  },
  warnings: [],
};
