import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  Controls: () => null,
  MarkerType: { ArrowClosed: 'arrowclosed' },
  ReactFlow: ({
    children,
    edges,
    nodes,
    onEdgeClick,
  }: {
    children: ReactNode;
    edges: Array<{ id: string; data?: Record<string, unknown> }>;
    nodes: Array<{ id: string }>;
    onEdgeClick?: (event: MouseEvent, edge: { id: string; data?: Record<string, unknown> }) => void;
  }) => (
    <div data-testid="react-flow">
      <span>{nodes.length} nodes</span>
      {edges.map((edge) => (
        <button key={edge.id} onClick={(event) => onEdgeClick?.(event.nativeEvent, edge)}>
          {edge.id}
        </button>
      ))}
      {children}
    </div>
  ),
}));

import { VersionGraphPanel } from '@/components/graph/VersionGraphPanel';
import type { FileFamily } from '../../../backend/contracts/family-clustering';
import type { RawFileMetadata } from '../../../backend/contracts/scan';
import type { SerializedVersionGraph } from '../../../backend/contracts/version-graph';

function file(name: string, version: number): RawFileMetadata {
  return {
    id: `file:${name}`,
    name,
    extension: 'docx',
    absolutePath: `C:\\project\\${name}`,
    relativePath: name,
    parentDirectory: '',
    directoryDepth: 0,
    size: 1024,
    modifiedAt: `2026-05-12T0${version + 7}:00:00.000Z`,
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

const files = [file('brief_v1.docx', 1), file('brief_v2.docx', 2)];
const family: FileFamily = {
  id: 'family:brief',
  displayName: 'brief',
  coreName: 'brief',
  fileIds: files.map((item) => item.id),
  confidence: 0.95,
  evidence: [],
};
const graph: SerializedVersionGraph = {
  schemaVersion: '1.0',
  nodes: files.map((item, index) => ({
    id: `node:${item.id}`,
    fileId: item.id,
    familyId: family.id,
    label: item.name,
    modifiedAt: item.modifiedAt,
    position: { x: index * 280, y: 0 },
    incomingMainEdgeCount: index,
    outgoingMainEdgeCount: 1 - index,
  })),
  edges: [
    {
      id: 'edge:brief-v1-v2',
      familyId: family.id,
      sourceFileId: files[0].id,
      targetFileId: files[1].id,
      role: 'main',
      relation: 'likely_successor',
      confidence: 0.95,
      scoreBreakdown: {
        nameSimilarity: 1,
        timeOrderScore: 1,
        sizeContinuityScore: 1,
        directoryRelationScore: 1,
        versionProgressionScore: 0.95,
      },
      evidence: [],
      overriddenByUser: false,
    },
  ],
  rootFileIds: [files[0].id],
  leafFileIds: [files[1].id],
  branchPointFileIds: [],
};

describe('version graph panel', () => {
  it('renders a read-only graph and reveals edge score evidence on click', () => {
    render(<VersionGraphPanel graph={graph} families={[family]} files={files} />);

    expect(screen.getByRole('heading', { name: '\u7248\u672c\u5173\u7cfb\u56fe' })).toBeInTheDocument();
    expect(screen.getByText('2 nodes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'edge:brief-v1-v2' }));
    expect(screen.getByRole('heading', { name: '\u8fb9\u8bc4\u5206\u4f9d\u636e' })).toBeInTheDocument();
    expect(screen.getByText('\u7efc\u5408\u7f6e\u4fe1\u5ea6')).toBeInTheDocument();
    expect(screen.getAllByText('95%').length).toBeGreaterThan(0);
  });
});
