import './generate-demo-fixture.mjs';
import { resolve } from 'node:path';
import { scanDirectory } from '../backend/scanner/directory-scanner';

const result = await scanDirectory({
  scanId: 'demo-fixture-verification',
  rootPath: resolve('fixtures/demo-project'),
  signal: new AbortController().signal,
  onProgress: () => undefined,
});

const checks: Array<[string, boolean]> = [
  ['12 demo files', result.files.length === 12],
  ['at least two file families', result.clustering.families.length >= 2],
  ['version relationships', result.versionGraph.edges.length > 0],
  ['timeline events', result.timeline.events.length > 0],
  ['risk clues', result.timeline.risks.length > 0],
  ['main-version candidates', result.mainVersions.candidates.length > 0],
];

const failed = checks.filter(([, passed]) => !passed).map(([label]) => label);
if (failed.length > 0) throw new Error(`Demo fixture verification failed: ${failed.join(', ')}`);

process.stdout.write(JSON.stringify({
  files: result.files.length,
  families: result.clustering.families.length,
  edges: result.versionGraph.edges.length,
  events: result.timeline.events.length,
  risks: result.timeline.risks.length,
  candidates: result.mainVersions.candidates.length,
}) + '\n');
