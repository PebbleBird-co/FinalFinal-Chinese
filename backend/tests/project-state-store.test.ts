// @vitest-environment node

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import type { PersistedProjectState } from '../contracts/override';
import type { ScanResult } from '../contracts/scan';
import { ProjectStateStore } from '../persistence/project-state-store';

const temporaryDirectories: string[] = [];

function emptyResult(): ScanResult {
  return {
    scanId: 'scan-persist',
    rootPath: 'C:\\project',
    scannedAt: '2026-05-13T09:00:00.000Z',
    completedAt: '2026-05-13T09:00:01.000Z',
    status: 'completed',
    limits: { maxFiles: 20_000, maxDepth: 20 },
    files: [],
    clustering: { families: [], strongRelations: [], weakRelations: [], candidatePairCount: 0, totalPossiblePairCount: 0 },
    versionGraph: { schemaVersion: '1.0', nodes: [], edges: [], rootFileIds: [], leafFileIds: [], branchPointFileIds: [] },
    timeline: { dailyActivity: [], events: [], risks: [] },
    mainVersions: { candidates: [], disclaimer: 'test' },
    warnings: [],
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('project state store', () => {
  it('round-trips the latest report and override history inside its fixed directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'file-archaeologist-'));
    temporaryDirectories.push(directory);
    const store = new ProjectStateStore(directory);
    const result = emptyResult();
    const state: PersistedProjectState = {
      schemaVersion: '1.0',
      baseResult: result,
      result,
      history: { past: [], present: [], future: [] },
      savedAt: '2026-05-13T09:00:02.000Z',
    };

    await store.save(state);
    await expect(store.load()).resolves.toEqual(state);
    const raw = await readFile(join(directory, 'project-state-v1.json'), 'utf8');
    expect(JSON.parse(raw)).toMatchObject({ schemaVersion: '1.0', savedAt: state.savedAt });
  });

  it('returns undefined when no saved project exists', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'file-archaeologist-'));
    temporaryDirectories.push(directory);
    await expect(new ProjectStateStore(directory).load()).resolves.toBeUndefined();
  });
});
