import { ipcMain } from 'electron';
import type { ExportPdfInput } from '../contracts/report';
import { exportReportPdf } from '../report/pdf-exporter';
import { IPC_CHANNELS } from './channels';

export function registerExportIpc(): void {
  ipcMain.handle(IPC_CHANNELS.exportPdf, (event, input: ExportPdfInput) =>
    exportReportPdf(event.sender, input),
  );
}
