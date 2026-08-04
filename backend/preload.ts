import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  CancelScanInput,
  DirectorySelection,
  ScanDirectoryInput,
  ScanProgress,
  ScanResult,
} from './contracts/scan';
import type { AnalyzeProjectInput, PersistedProjectState } from './contracts/override';
import type { ExportPdfInput, ExportPdfResult } from './contracts/report';
import { IPC_CHANNELS } from './ipc/channels';

export interface FileArchaeologistApi {
  platform: NodeJS.Platform;
  versions: Readonly<{
    electron: string;
    chrome: string;
  }>;
  selectDirectory(): Promise<DirectorySelection>;
  authorizeDroppedDirectory(file: File): Promise<DirectorySelection>;
  scanDirectory(input: ScanDirectoryInput): Promise<ScanResult>;
  cancelScan(input: CancelScanInput): Promise<boolean>;
  onScanProgress(listener: (progress: ScanProgress) => void): () => void;
  analyzeProject(input: AnalyzeProjectInput): Promise<ScanResult>;
  saveProjectState(state: PersistedProjectState): Promise<void>;
  loadProjectState(): Promise<PersistedProjectState | undefined>;
  exportPdf(input: ExportPdfInput): Promise<ExportPdfResult>;
}

const api: FileArchaeologistApi = {
  platform: process.platform,
  versions: Object.freeze({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  }),
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.selectDirectory),
  authorizeDroppedDirectory: (file) => {
    const droppedPath = webUtils.getPathForFile(file);
    return ipcRenderer.invoke(IPC_CHANNELS.authorizeDroppedDirectory, droppedPath);
  },
  scanDirectory: (input) => ipcRenderer.invoke(IPC_CHANNELS.scanDirectory, input),
  cancelScan: (input) => ipcRenderer.invoke(IPC_CHANNELS.cancelScan, input),
  onScanProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ScanProgress) =>
      listener(progress);
    ipcRenderer.on(IPC_CHANNELS.scanProgress, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.scanProgress, handler);
  },
  analyzeProject: (input) => ipcRenderer.invoke(IPC_CHANNELS.analyzeProject, input),
  saveProjectState: (state) => ipcRenderer.invoke(IPC_CHANNELS.saveProjectState, state),
  loadProjectState: () => ipcRenderer.invoke(IPC_CHANNELS.loadProjectState),
  exportPdf: (input) => ipcRenderer.invoke(IPC_CHANNELS.exportPdf, input),
};

contextBridge.exposeInMainWorld('fileArchaeologist', Object.freeze(api));
