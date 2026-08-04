import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions, type WebContents } from 'electron';
import type { CancelScanInput, ScanDirectoryInput } from '../contracts/scan';
import { scanDirectory } from '../scanner/directory-scanner';
import { DirectoryAccessRegistry, resolveDirectoryPath } from '../security/path-guard';
import { IPC_CHANNELS } from './channels';

const directoryAccess = new DirectoryAccessRegistry();
const activeScans = new Map<string, AbortController>();

function scanKey(sender: WebContents, scanId: string): string {
  return `${sender.id}:${scanId}`;
}

function assertScanId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(value)) {
    throw new Error('Invalid scan identifier.');
  }
}

export function registerScanIpc(): void {
  ipcMain.handle(IPC_CHANNELS.selectDirectory, async (event) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      title: '选择要调查的项目文件夹',
      properties: ['openDirectory'],
    };
    const selection = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options);

    if (selection.canceled || !selection.filePaths[0]) return { canceled: true };

    const rootPath = await resolveDirectoryPath(selection.filePaths[0]);
    directoryAccess.authorize(rootPath);
    return { canceled: false, path: rootPath };
  });

  ipcMain.handle(IPC_CHANNELS.authorizeDroppedDirectory, async (_event, droppedPath: unknown) => {
    if (typeof droppedPath !== 'string' || droppedPath.length === 0) {
      throw new Error('Dropped item does not expose a local directory path.');
    }

    const rootPath = await resolveDirectoryPath(droppedPath);
    directoryAccess.authorize(rootPath);
    return { canceled: false, path: rootPath };
  });

  ipcMain.handle(IPC_CHANNELS.scanDirectory, async (event, input: ScanDirectoryInput) => {
    assertScanId(input?.scanId);
    if (typeof input.rootPath !== 'string') throw new Error('Invalid scan root path.');

    const rootPath = await resolveDirectoryPath(input.rootPath);
    directoryAccess.assertAuthorized(rootPath);

    const key = scanKey(event.sender, input.scanId);
    if (activeScans.has(key)) throw new Error('A scan with this identifier is already running.');

    const controller = new AbortController();
    activeScans.set(key, controller);
    const abortWhenRendererCloses = () => controller.abort();
    event.sender.once('destroyed', abortWhenRendererCloses);

    try {
      return await scanDirectory({
        scanId: input.scanId,
        rootPath,
        signal: controller.signal,
        onProgress: (progress) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.scanProgress, progress);
          }
        },
      });
    } finally {
      activeScans.delete(key);
      event.sender.removeListener('destroyed', abortWhenRendererCloses);
    }
  });

  ipcMain.handle(IPC_CHANNELS.cancelScan, (event, input: CancelScanInput) => {
    assertScanId(input?.scanId);
    const controller = activeScans.get(scanKey(event.sender, input.scanId));
    controller?.abort();
    return controller !== undefined;
  });
}
