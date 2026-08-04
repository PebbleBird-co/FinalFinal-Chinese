// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import { lstat, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanDirectory, type ScannerFileSystem } from '../scanner/directory-scanner';

const temporaryRoots: string[] = [];

async function createFixture(): Promise<string> {
  const rootPath = await mkdtemp(join(tmpdir(), 'file-archaeologist-'));
  temporaryRoots.push(rootPath);
  return rootPath;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((rootPath) => rm(rootPath, { recursive: true, force: true })),
  );
});

describe('read-only directory scanner', () => {
  it('returns file metadata and applies default ignore rules', async () => {
    const rootPath = await createFixture();
    await mkdir(join(rootPath, '工作稿'));
    await mkdir(join(rootPath, 'node_modules'));
    await writeFile(join(rootPath, '项目计划.docx'), 'metadata-only fixture');
    await writeFile(join(rootPath, '工作稿', '项目计划_修改版.docx'), 'another fixture');
    await writeFile(join(rootPath, 'node_modules', 'ignored.js'), 'ignored');
    await writeFile(join(rootPath, 'scratch.tmp'), 'ignored');

    const result = await scanDirectory({ scanId: 'scan-test-001', rootPath });

    expect(result.status).toBe('completed');
    expect(result.files.map((file) => file.relativePath).sort()).toEqual([
      join('工作稿', '项目计划_修改版.docx'),
      '项目计划.docx',
    ]);
    expect(result.files[0]).toMatchObject({ extension: 'docx' });
    expect(result.files.every((file) => file.size > 0 && file.modifiedAt.length > 0)).toBe(true);
    expect(result.files.every((file) => file.analysis.originalName === file.name)).toBe(true);
    expect(result.clustering.families).toHaveLength(1);
    expect(result.clustering.families[0].fileIds).toHaveLength(2);
    expect(result.versionGraph.nodes).toHaveLength(2);
    expect(result.timeline.dailyActivity.length).toBeGreaterThan(0);
    expect(result.mainVersions.candidates.length).toBeGreaterThan(0);
  });

  it('stops safely when the file limit is reached', async () => {
    const rootPath = await createFixture();
    await writeFile(join(rootPath, 'a.txt'), 'a');
    await writeFile(join(rootPath, 'b.txt'), 'b');

    const result = await scanDirectory({ scanId: 'scan-test-002', rootPath, maxFiles: 1 });

    expect(result.status).toBe('limit_reached');
    expect(result.files).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.code === 'FILE_LIMIT_REACHED')).toBe(true);
  });

  it('records an unreadable directory and continues with other files', async () => {
    const rootPath = await createFixture();
    const blockedPath = join(rootPath, 'blocked');
    await mkdir(blockedPath);
    await writeFile(join(rootPath, 'visible.txt'), 'visible');

    const fileSystem: ScannerFileSystem = {
      readDirectory: async (path) => {
        if (path === blockedPath) {
          throw Object.assign(new Error('denied'), { code: 'EACCES' });
        }
        return readdir(path, { withFileTypes: true });
      },
      readMetadata: (path) => lstat(path),
    };

    const result = await scanDirectory({ scanId: 'scan-test-003', rootPath, fileSystem });

    expect(result.status).toBe('completed');
    expect(result.files.map((file) => file.name)).toContain('visible.txt');
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'DIRECTORY_UNREADABLE', path: blockedPath }),
    );
  });

  it('honors cancellation before reading the directory', async () => {
    const rootPath = await createFixture();
    await writeFile(join(rootPath, 'unvisited.txt'), 'not visited');
    const controller = new AbortController();
    controller.abort();

    const result = await scanDirectory({
      scanId: 'scan-test-004',
      rootPath,
      signal: controller.signal,
    });

    expect(result.status).toBe('canceled');
    expect(result.files).toHaveLength(0);
  });
});
