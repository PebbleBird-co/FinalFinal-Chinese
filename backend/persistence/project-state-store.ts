import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PersistedProjectState } from '../contracts/override';
import { validateOverrides } from '../overrides/override-applier';

const STATE_FILE = 'project-state-v1.json';

function validateState(value: unknown): asserts value is PersistedProjectState {
  if (!value || typeof value !== 'object') throw new Error('保存的项目状态格式无效。');
  const state = value as Partial<PersistedProjectState>;
  if (state.schemaVersion !== '1.0' || !state.baseResult || !state.result || !state.history) {
    throw new Error('保存的项目状态版本不受支持。');
  }
  if (state.baseResult.rootPath !== state.result.rootPath) {
    throw new Error('保存的项目状态路径不一致。');
  }
  validateOverrides(state.history.present);
  for (const snapshot of [...state.history.past, ...state.history.future]) validateOverrides(snapshot);
}

export class ProjectStateStore {
  constructor(private readonly userDataPath: string) {}

  private get statePath(): string {
    return join(this.userDataPath, STATE_FILE);
  }

  async load(): Promise<PersistedProjectState | undefined> {
    try {
      const raw = await readFile(this.statePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      validateState(parsed);
      return parsed;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return undefined;
      throw error;
    }
  }

  async save(state: PersistedProjectState): Promise<void> {
    validateState(state);
    await mkdir(this.userDataPath, { recursive: true });
    const temporaryPath = `${this.statePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 });
    try {
      await rename(temporaryPath, this.statePath);
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || !['EEXIST', 'EPERM'].includes(String(error.code))) throw error;
      await rm(this.statePath, { force: true });
      await rename(temporaryPath, this.statePath);
    }
  }
}
