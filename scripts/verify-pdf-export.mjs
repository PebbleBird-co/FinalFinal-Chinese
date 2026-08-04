import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const temporaryDirectory = resolve('tmp/pdfs');
const outputDirectory = resolve('output/pdf');
const temporaryEntry = resolve(temporaryDirectory, 'pdf-qa-main.mjs');
const outputPdf = resolve(outputDirectory, 'phase9-sample-report.pdf');

await mkdir(temporaryDirectory, { recursive: true });
await mkdir(outputDirectory, { recursive: true });
await rm(outputPdf, { force: true });

try {
  await build({
    entryPoints: [resolve('scripts/pdf-qa-entry.ts')],
    outfile: temporaryEntry,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    external: ['electron'],
    logLevel: 'warning',
  });
  const executed = spawnSync(electronPath, ['--no-sandbox', '--disable-gpu', temporaryEntry, outputPdf], {
    cwd: process.cwd(),
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    stdio: 'inherit',
    windowsHide: true,
  });
  if (executed.status !== 0) throw new Error(`Electron PDF QA exited with code ${executed.status ?? 'unknown'}.`);
  const outputStat = await stat(outputPdf);
  const header = (await readFile(outputPdf)).subarray(0, 5).toString('ascii');
  if (outputStat.size < 1_000 || header !== '%PDF-') throw new Error('Electron PDF QA produced an invalid PDF file.');
  process.stdout.write(`${outputPdf}\n`);
} finally {
  await rm(temporaryEntry, { force: true });
}
