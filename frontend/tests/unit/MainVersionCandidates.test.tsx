import { fireEvent, render, screen } from '@testing-library/react';
import { MainVersionCandidates } from '@/components/ranking/MainVersionCandidates';
import type { FileFamily } from '../../../backend/contracts/family-clustering';
import type { MainVersionRanking } from '../../../backend/contracts/main-version';
import type { RawFileMetadata } from '../../../backend/contracts/scan';

function file(name: string, version: number): RawFileMetadata {
  return {
    id: `file:${name}`,
    name,
    extension: 'docx',
    absolutePath: `C:\\project\\${name}`,
    relativePath: name,
    parentDirectory: 'working',
    directoryDepth: 1,
    size: 1024,
    modifiedAt: `2026-05-1${version}T08:00:00.000Z`,
    analysis: {
      originalName: name,
      stem: name.replace('.docx', ''),
      extension: 'docx',
      normalizedName: `brief v${version}`,
      coreName: 'brief',
      semanticTokens: ['brief'],
      versionTokens: [
        { raw: `v${version}`, normalized: String(version), category: 'numeric', weight: 0.65, position: 6 },
      ],
      dateTokens: [],
      numericVersion: [version],
    },
  };
}

const files = [file('brief_v2.docx', 2), file('brief_final_v1.docx', 1)];
const family: FileFamily = {
  id: 'family:brief',
  displayName: 'brief',
  coreName: 'brief',
  fileIds: files.map((item) => item.id),
  confidence: 0.9,
  evidence: [],
};
const baseBreakdown = {
  recencyScore: 1,
  graphLeafScore: 1,
  versionMarkerScore: 0.55,
  directoryIntentScore: 0.6,
  branchCentralityScore: 0.95,
  sizePlausibilityScore: 1,
  userConfirmationScore: 0,
};
const ranking: MainVersionRanking = {
  disclaimer: '\u6587\u4ef6\u540d\u4e2d\u7684\u201c\u6700\u7ec8\u201d\u53ea\u4f5c\u4e3a\u5f31\u8bc1\u636e\uff0c\u4e0d\u80fd\u8bc1\u660e\u8be5\u6587\u4ef6\u4e00\u5b9a\u662f\u6b63\u5f0f\u7248\u672c\u3002',
  candidates: [
    {
      fileId: files[0].id,
      familyId: family.id,
      score: 0.82,
      confidence: 0.82,
      confidenceText: '\u8f83\u53ef\u80fd',
      rank: 1,
      recommended: true,
      scoreBreakdown: baseBreakdown,
      penalties: [],
      evidence: [
        { type: 'recencyScore', description: 'recent', value: 1, impact: 'positive' },
        { type: 'graphLeafScore', description: 'leaf', value: 1, impact: 'positive' },
        { type: 'versionMarkerScore', description: 'marker', value: 0.55, impact: 'neutral' },
      ],
      warnings: ['\u9700\u8981\u4eba\u5de5\u786e\u8ba4\u3002'],
    },
    {
      fileId: files[1].id,
      familyId: family.id,
      score: 0.38,
      confidence: 0.38,
      confidenceText: '\u4e0d\u5efa\u8bae\u4f5c\u4e3a\u6b63\u5f0f\u5019\u9009',
      rank: 2,
      recommended: false,
      scoreBreakdown: { ...baseBreakdown, recencyScore: 0, graphLeafScore: 0.2 },
      penalties: [
        { type: 'has_successor', value: 0.18, description: '\u7248\u672c\u56fe\u4e2d\u5b58\u5728\u660e\u786e\u7684\u540e\u7ee7\u6587\u4ef6\u3002' },
      ],
      evidence: [
        { type: 'recencyScore', description: 'old', value: 0, impact: 'neutral' },
        { type: 'graphLeafScore', description: 'not leaf', value: 0.2, impact: 'neutral' },
        { type: 'has_successor', description: 'successor', value: 0.18, impact: 'negative' },
      ],
      warnings: ['\u5019\u9009\u7f6e\u4fe1\u5ea6\u8f83\u4f4e\uff0c\u5e94\u7531\u7528\u6237\u4eba\u5de5\u786e\u8ba4\u3002'],
    },
  ],
};

describe('main version candidates', () => {
  it('shows ranked evidence, mandatory disclaimer, and low-confidence penalties', () => {
    render(<MainVersionCandidates ranking={ranking} families={[family]} files={files} />);

    expect(screen.getByRole('heading', { name: '\u6b63\u5f0f\u7248\u672c\u5019\u9009' })).toBeInTheDocument();
    expect(screen.getByText(/\u53ea\u4f5c\u4e3a\u5f31\u8bc1\u636e/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /brief_final_v1\.docx/ }));
    expect(screen.getByRole('heading', { name: 'brief_final_v1.docx' })).toBeInTheDocument();
    expect(screen.getByText('\u7248\u672c\u56fe\u4e2d\u5b58\u5728\u660e\u786e\u7684\u540e\u7ee7\u6587\u4ef6\u3002')).toBeInTheDocument();
    expect(screen.getByText('\u5019\u9009\u7f6e\u4fe1\u5ea6\u8f83\u4f4e\uff0c\u5e94\u7531\u7528\u6237\u4eba\u5de5\u786e\u8ba4\u3002')).toBeInTheDocument();
  });
});
