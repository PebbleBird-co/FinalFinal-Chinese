import { app, ipcMain } from 'electron';
import type { AnalyzeProjectInput, PersistedProjectState } from '../contracts/override';
import { applyOverrides } from '../overrides/override-applier';
import { ProjectStateStore } from '../persistence/project-state-store';
import { IPC_CHANNELS } from './channels';

function assertAnalyzeInput(input: AnalyzeProjectInput): void {
  if (!input || typeof input !== 'object' || !input.baseResult || !Array.isArray(input.overrides)) {
    throw new Error('分析纠正输入无效。');
  }
  if (typeof input.baseResult.rootPath !== 'string' || !Array.isArray(input.baseResult.files)) {
    throw new Error('基础扫描结果无效。');
  }
}

export function registerProjectIpc(): void {
  const store = new ProjectStateStore(app.getPath('userData'));
  ipcMain.handle(IPC_CHANNELS.analyzeProject, (_event, input: AnalyzeProjectInput) => {
    assertAnalyzeInput(input);
    return applyOverrides(input.baseResult, input.overrides);
  });
  ipcMain.handle(IPC_CHANNELS.saveProjectState, (_event, state: PersistedProjectState) => store.save(state));
  ipcMain.handle(IPC_CHANNELS.loadProjectState, () => store.load());
}
