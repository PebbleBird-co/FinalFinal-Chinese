import { render, screen } from '@testing-library/react';
import type { RawFileMetadata } from '../../../backend/contracts/scan';
import { FilenameAnalysisTable } from '@/components/analysis/FilenameAnalysisTable';

const file: RawFileMetadata = {
  id: 'file:brief.docx',
  name: '\u5ba2\u6237\u8fc1\u79fb\u65b9\u6848_v2.docx',
  extension: 'docx',
  absolutePath: 'C:\\project\\brief.docx',
  relativePath: 'brief.docx',
  parentDirectory: '',
  directoryDepth: 0,
  size: 2048,
  modifiedAt: '2026-05-12T08:00:00.000Z',
  analysis: {
    originalName: '\u5ba2\u6237\u8fc1\u79fb\u65b9\u6848_v2.docx',
    stem: '\u5ba2\u6237\u8fc1\u79fb\u65b9\u6848_v2',
    extension: 'docx',
    normalizedName: '\u5ba2\u6237\u8fc1\u79fb\u65b9\u6848 v2',
    coreName: '\u5ba2\u6237\u8fc1\u79fb',
    semanticTokens: ['\u5ba2\u6237\u8fc1\u79fb'],
    versionTokens: [
      { raw: 'v2', normalized: '2', category: 'numeric', weight: 0.65, position: 7 },
    ],
    dateTokens: [],
    numericVersion: [2],
  },
};

describe('filename analysis table', () => {
  it('shows the normalized signals without presenting a family inference', () => {
    render(<FilenameAnalysisTable files={[file]} />);

    expect(screen.getByRole('heading', { name: '\u6587\u4ef6\u540d\u5206\u6790' })).toBeInTheDocument();
    expect(screen.getByText('\u5ba2\u6237\u8fc1\u79fb\u65b9\u6848 v2')).toBeInTheDocument();
    expect(screen.getByText('\u5ba2\u6237\u8fc1\u79fb')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByText(/\u4e0d\u8868\u793a\u6587\u4ef6\u4e4b\u95f4\u5df2\u5efa\u7acb\u7248\u672c\u5173\u7cfb/)).toBeInTheDocument();
  });
});
