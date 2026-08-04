import { create } from 'zustand';
import type {
  OverrideHistory,
  PersistedProjectState,
  UserOverride,
  UserOverrideType,
} from '../../../backend/contracts/override';
import type { ScanResult } from '../../../backend/contracts/scan';

type ProjectStatus = 'idle' | 'loading' | 'ready' | 'error';
type PersistenceStatus = 'idle' | 'saving' | 'saved' | 'error';
type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';

function emptyHistory(): OverrideHistory {
  return { past: [], present: [], future: [] };
}

interface ProjectState {
  baseResult?: ScanResult;
  result?: ScanResult;
  history: OverrideHistory;
  status: ProjectStatus;
  persistenceStatus: PersistenceStatus;
  isApplyingOverride: boolean;
  exportStatus: ExportStatus;
  exportError?: string;
  lastExportPath?: string;
  error?: string;
  correctionError?: string;
  beginScan: () => void;
  setResult: (result: ScanResult) => Promise<void>;
  setError: (message: string) => void;
  restore: () => Promise<void>;
  applyOverride: (
    type: UserOverrideType,
    targetIds: string[],
    payload?: Record<string, unknown>,
  ) => Promise<boolean>;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  recalculate: () => Promise<boolean>;
  exportPdf: () => Promise<boolean>;
  dismissExportStatus: () => void;
  dismissCorrectionError: () => void;
  clear: () => void;
}

function persistedState(
  baseResult: ScanResult,
  result: ScanResult,
  history: OverrideHistory,
): PersistedProjectState {
  return {
    schemaVersion: '1.0',
    baseResult,
    result,
    history,
    savedAt: new Date().toISOString(),
  };
}

export const useProjectStore = create<ProjectState>((set, get) => {
  const commitHistory = async (history: OverrideHistory): Promise<boolean> => {
    const { baseResult } = get();
    const api = window.fileArchaeologist;
    if (!baseResult || !api) {
      set({ correctionError: '用户纠正只能在 Final-Final 桌面应用中保存。' });
      return false;
    }
    set({ isApplyingOverride: true, correctionError: undefined, persistenceStatus: 'saving' });
    try {
      const result = await api.analyzeProject({ baseResult, overrides: history.present });
      await api.saveProjectState(persistedState(baseResult, result, history));
      set({
        result,
        history,
        status: 'ready',
        isApplyingOverride: false,
        persistenceStatus: 'saved',
      });
      return true;
    } catch (error) {
      set({
        isApplyingOverride: false,
        persistenceStatus: 'error',
        correctionError: error instanceof Error ? error.message : '纠正未能应用，请重试。',
      });
      return false;
    }
  };

  return {
    history: emptyHistory(),
    status: 'idle',
    persistenceStatus: 'idle',
    isApplyingOverride: false,
    exportStatus: 'idle',
    beginScan: () => set({ status: 'loading', error: undefined, correctionError: undefined }),
    setResult: async (result) => {
      const history = emptyHistory();
      set({
        baseResult: result,
        result,
        history,
        status: 'ready',
        error: undefined,
        correctionError: undefined,
        persistenceStatus: window.fileArchaeologist ? 'saving' : 'idle',
      });
      const api = window.fileArchaeologist;
      if (!api) return;
      try {
        await api.saveProjectState(persistedState(result, result, history));
        set({ persistenceStatus: 'saved' });
      } catch (error) {
        set({
          persistenceStatus: 'error',
          correctionError: error instanceof Error ? error.message : '扫描结果未能保存到本地。',
        });
      }
    },
    setError: (error) => set({ status: 'error', error }),
    restore: async () => {
      const api = window.fileArchaeologist;
      if (!api || get().result) return;
      set({ status: 'loading' });
      try {
        const saved = await api.loadProjectState();
        if (!saved) {
          set({ status: 'idle' });
          return;
        }
        set({
          baseResult: saved.baseResult,
          result: saved.result,
          history: saved.history,
          status: 'ready',
          persistenceStatus: 'saved',
          error: undefined,
        });
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : '本地项目报告未能恢复。',
        });
      }
    },
    applyOverride: async (type, targetIds, payload = {}) => {
      if (get().isApplyingOverride) return false;
      const present = get().history.present;
      const override: UserOverride = {
        id: crypto.randomUUID(),
        type,
        targetIds,
        payload,
        createdAt: new Date().toISOString(),
      };
      return commitHistory({
        past: [...get().history.past, present],
        present: [...present, override],
        future: [],
      });
    },
    undo: async () => {
      const { history, isApplyingOverride } = get();
      if (isApplyingOverride || history.past.length === 0) return false;
      const previous = history.past.at(-1) ?? [];
      return commitHistory({
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
      });
    },
    redo: async () => {
      const { history, isApplyingOverride } = get();
      const next = history.future[0];
      if (isApplyingOverride || !next) return false;
      return commitHistory({
        past: [...history.past, history.present],
        present: next,
        future: history.future.slice(1),
      });
    },
    recalculate: async () => commitHistory(get().history),
    exportPdf: async () => {
      const { result, history, exportStatus } = get();
      const api = window.fileArchaeologist;
      if (exportStatus === 'exporting') return false;
      if (!result || !api) {
        set({ exportStatus: 'error', exportError: 'PDF 只能在 Final-Final 桌面应用中导出。' });
        return false;
      }
      set({ exportStatus: 'exporting', exportError: undefined, lastExportPath: undefined });
      try {
        const exported = await api.exportPdf({
          result,
          overrideCount: history.present.length,
        });
        if (exported.canceled) {
          set({ exportStatus: 'idle' });
          return false;
        }
        set({ exportStatus: 'success', lastExportPath: exported.outputPath });
        return true;
      } catch (error) {
        set({
          exportStatus: 'error',
          exportError: error instanceof Error ? error.message : 'PDF 报告未能导出。',
        });
        return false;
      }
    },
    dismissExportStatus: () => set({ exportStatus: 'idle', exportError: undefined, lastExportPath: undefined }),
    dismissCorrectionError: () => set({ correctionError: undefined }),
    clear: () => set({
      baseResult: undefined,
      result: undefined,
      history: emptyHistory(),
      status: 'idle',
      persistenceStatus: 'idle',
      isApplyingOverride: false,
      exportStatus: 'idle',
      exportError: undefined,
      lastExportPath: undefined,
      error: undefined,
      correctionError: undefined,
    }),
  };
});
