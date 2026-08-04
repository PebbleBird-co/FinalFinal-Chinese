import { mkdir, writeFile, utimes } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const root = resolve('fixtures/demo-project');
const files = [
  ['产品策划案_v1.txt', '2026-01-08T09:10:00.000Z', 4_800],
  ['产品策划案_v2_修改.txt', '2026-01-15T15:40:00.000Z', 5_300],
  ['产品策划案_客户反馈分支.txt', '2026-01-18T11:25:00.000Z', 5_100],
  ['产品策划案_v3.txt', '2026-01-24T17:05:00.000Z', 5_900],
  ['产品策划案_最终版.txt', '2026-02-02T10:20:00.000Z', 6_200],
  ['产品策划案_最终版_修改.txt', '2026-02-03T14:35:00.000Z', 6_350],
  ['产品策划案_提交版.txt', '2026-02-05T09:00:00.000Z', 6_500],
  ['archive/产品策划案_v1_备份.txt', '2026-02-08T16:10:00.000Z', 4_800],
  ['交付/产品策划案_提交版_copy.txt', '2026-02-05T09:06:00.000Z', 6_500],
  ['调研报告_初稿.txt', '2026-01-10T13:30:00.000Z', 3_800],
  ['调研报告_修订版.txt', '2026-01-22T10:15:00.000Z', 4_200],
  ['调研报告_定稿.txt', '2026-02-01T18:20:00.000Z', 4_600],
];

await mkdir(root, { recursive: true });
for (const [relativePath, modifiedAt, size] of files) {
  const target = resolve(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  const heading = `File Archaeologist metadata-only demo: ${relativePath}\n`;
  await writeFile(target, heading.padEnd(size, '.'), 'utf8');
  const timestamp = new Date(modifiedAt);
  await utimes(target, timestamp, timestamp);
}

process.stdout.write(`${root}\n`);
