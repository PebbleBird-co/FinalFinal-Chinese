import { render, screen } from '@testing-library/react';
import { FamilySummary } from '@/components/analysis/FamilySummary';
import type { FamilyClusteringResult } from '../../../backend/contracts/family-clustering';
import type { RawFileMetadata } from '../../../backend/contracts/scan';

const analysis = {
  originalName: 'brief_v1.docx',
  stem: 'brief_v1',
  extension: 'docx',
  normalizedName: 'brief v1',
  coreName: 'brief',
  semanticTokens: ['brief'],
  versionTokens: [
    { raw: 'v1', normalized: '1', category: 'numeric' as const, weight: 0.65, position: 6 },
  ],
  dateTokens: [],
  numericVersion: [1],
};

const files: RawFileMetadata[] = ['v1', 'v2'].map((version, index) => ({
  id: `file:brief_${version}.docx`,
  name: `brief_${version}.docx`,
  extension: 'docx',
  absolutePath: `C:\\project\\brief_${version}.docx`,
  relativePath: `brief_${version}.docx`,
  parentDirectory: '',
  directoryDepth: 0,
  size: 1024 + index,
  modifiedAt: '2026-05-12T08:00:00.000Z',
  analysis: { ...analysis, originalName: `brief_${version}.docx` },
}));

const clustering: FamilyClusteringResult = {
  families: [
    {
      id: 'family:file:brief_v1.docx',
      displayName: 'brief',
      coreName: 'brief',
      fileIds: files.map((file) => file.id),
      confidence: 0.91,
      evidence: [],
    },
  ],
  strongRelations: [],
  weakRelations: [],
  candidatePairCount: 1,
  totalPossiblePairCount: 1,
};

describe('family summary', () => {
  it('labels family clustering as an inference requiring confirmation', () => {
    render(<FamilySummary clustering={clustering} files={files} />);

    expect(screen.getByRole('heading', { name: '\u6587\u4ef6\u5bb6\u65cf\u63a8\u6d4b' })).toBeInTheDocument();
    expect(screen.getByText(/\u9700\u8981\u4eba\u5de5\u786e\u8ba4/)).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText(/brief_v1\.docx/)).toBeInTheDocument();
  });
});
