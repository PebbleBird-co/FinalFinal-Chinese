// @vitest-environment node

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeFilename } from '../analysis/filename-analyzer';
import { clusterFileFamilies } from '../clustering/family-clusterer';
import { buildVersionGraph, wouldCreateCycle } from '../inference/graph-builder';
import type { RawFileMetadata } from '../contracts/scan';

function file(name: string, hour: number, directory = 'working'): RawFileMetadata {
  const relativePath = join(directory, name);
  return {
    id: `file:${relativePath.replaceAll('\\', '/')}`,
    name,
    extension: name.split('.').at(-1)?.toLowerCase() ?? '',
    absolutePath: join('C:\\project', relativePath),
    relativePath,
    parentDirectory: directory,
    directoryDepth: 1,
    size: 1000 + hour * 10,
    modifiedAt: `2026-05-12T${String(hour).padStart(2, '0')}:00:00.000Z`,
    analysis: analyzeFilename(name),
  };
}

function graphFor(files: RawFileMetadata[]) {
  const clustering = clusterFileFamilies(files);
  return buildVersionGraph(files, clustering.families);
}

describe('version graph builder', () => {
  it('builds an acyclic main chain and limits alternate parents', () => {
    const files = [
      file('brief_v1.docx', 8),
      file('brief_v2.docx', 9),
      file('brief_v3.docx', 10),
      file('brief_v4.docx', 11),
      file('brief_v5.docx', 12),
    ];
    const graph = graphFor(files);
    const v3 = files[2].id;
    const v3Parents = graph.edges.filter((edge) => edge.targetFileId === v3);

    expect(graph.schemaVersion).toBe('1.0');
    expect(v3Parents.filter((edge) => edge.role === 'main')).toHaveLength(1);
    expect(v3Parents.filter((edge) => edge.role === 'alternate').length).toBeLessThanOrEqual(2);
    expect(graph.rootFileIds).toEqual([files[0].id]);
    expect(graph.leafFileIds).toEqual([files[4].id]);
    expect(graph.edges.every((edge) => !wouldCreateCycle(
      graph.edges.filter((candidate) => candidate.id !== edge.id),
      edge.sourceFileId,
      edge.targetFileId,
    ))).toBe(true);
  });

  it('marks one predecessor with multiple main successors as a possible branch', () => {
    const files = [
      file('brief_v1.docx', 8),
      file('brief_v2.docx', 9, 'working/alpha'),
      file('brief_v2.docx', 10, 'working/beta'),
    ];
    const graph = graphFor(files);

    expect(graph.branchPointFileIds).toContain(files[0].id);
    expect(
      graph.edges.filter((edge) => edge.sourceFileId === files[0].id && edge.role === 'main'),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ relation: 'possible_branch' })]));
  });

  it('detects a proposed cycle before adding the edge', () => {
    const edges = [
      { sourceFileId: 'a', targetFileId: 'b' },
      { sourceFileId: 'b', targetFileId: 'c' },
    ];
    expect(wouldCreateCycle(edges, 'c', 'a')).toBe(true);
    expect(wouldCreateCycle(edges, 'a', 'c')).toBe(false);
  });
});
