import { useProjectStore } from '@/store/project.store';
import { reportResult } from '../fixtures/report-result';

describe('project override history', () => {
  const analyzeProject = vi.fn(async ({ baseResult }: { baseResult: typeof reportResult }) => baseResult);
  const saveProjectState = vi.fn(async () => undefined);
  const exportPdf = vi.fn(async () => ({ canceled: false, outputPath: 'C:\\Reports\\项目报告.pdf' }));

  beforeEach(() => {
    useProjectStore.getState().clear();
    analyzeProject.mockClear();
    saveProjectState.mockClear();
    exportPdf.mockClear();
    Object.defineProperty(window, 'fileArchaeologist', {
      configurable: true,
      value: {
        analyzeProject,
        saveProjectState,
        loadProjectState: vi.fn(async () => undefined),
        exportPdf,
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'fileArchaeologist');
  });

  it('saves a correction and supports undo and redo snapshots', async () => {
    await useProjectStore.getState().setResult(reportResult);
    await expect(useProjectStore.getState().applyOverride('set_main_version', ['file-final'])).resolves.toBe(true);
    expect(useProjectStore.getState().history.present).toHaveLength(1);
    expect(saveProjectState).toHaveBeenCalledTimes(2);

    await expect(useProjectStore.getState().undo()).resolves.toBe(true);
    expect(useProjectStore.getState().history.present).toHaveLength(0);
    expect(useProjectStore.getState().history.future).toHaveLength(1);

    await expect(useProjectStore.getState().redo()).resolves.toBe(true);
    expect(useProjectStore.getState().history.present).toHaveLength(1);
    expect(analyzeProject).toHaveBeenCalledTimes(3);
  });

  it('restores the saved report and correction history after a fresh store state', async () => {
    const saved = {
      schemaVersion: '1.0' as const,
      baseResult: reportResult,
      result: reportResult,
      history: {
        past: [],
        present: [{
          id: 'override-restored',
          type: 'set_main_version' as const,
          targetIds: ['file-final'],
          payload: {},
          createdAt: '2026-06-03T10:01:00.000Z',
        }],
        future: [],
      },
      savedAt: '2026-06-03T10:01:01.000Z',
    };
    Object.defineProperty(window, 'fileArchaeologist', {
      configurable: true,
      value: {
        analyzeProject,
        saveProjectState,
        loadProjectState: vi.fn(async () => saved),
        exportPdf,
      },
    });

    await useProjectStore.getState().restore();

    expect(useProjectStore.getState()).toMatchObject({
      status: 'ready',
      persistenceStatus: 'saved',
      result: reportResult,
    });
    expect(useProjectStore.getState().history.present).toHaveLength(1);
  });

  it('reports the selected PDF output path after a successful export', async () => {
    await useProjectStore.getState().setResult(reportResult);

    await expect(useProjectStore.getState().exportPdf()).resolves.toBe(true);

    expect(exportPdf).toHaveBeenCalledWith({ result: reportResult, overrideCount: 0 });
    expect(useProjectStore.getState()).toMatchObject({
      exportStatus: 'success',
      lastExportPath: 'C:\\Reports\\项目报告.pdf',
    });
  });
});
