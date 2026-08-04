import { BrowserWindow, dialog, type SaveDialogOptions, type WebContents } from 'electron';
import { writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { ExportPdfInput, ExportPdfResult } from '../contracts/report';
import { buildReportHtml, safeReportFilename } from './report-template';
import { REPORT_PRINT_OPTIONS } from './print-options';

function validateInput(input: ExportPdfInput): void {
  if (!input || typeof input !== 'object' || !input.result || !Array.isArray(input.result.files)) {
    throw new Error('PDF 报告输入无效。');
  }
  if (typeof input.result.rootPath !== 'string' || input.result.rootPath.length === 0) {
    throw new Error('PDF 报告缺少项目路径。');
  }
  if (!Number.isInteger(input.overrideCount) || input.overrideCount < 0 || input.overrideCount > 10_000) {
    throw new Error('PDF 报告纠正数量无效。');
  }
}

export async function renderReportPdf(input: ExportPdfInput): Promise<Uint8Array> {
  validateInput(input);
  const reportWindow = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  reportWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  reportWindow.webContents.setAudioMuted(true);
  try {
    const html = buildReportHtml(input);
    await reportWindow.loadURL(`data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`);
    await reportWindow.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    return await reportWindow.webContents.printToPDF(REPORT_PRINT_OPTIONS);
  } finally {
    if (!reportWindow.isDestroyed()) reportWindow.destroy();
  }
}

export async function exportReportPdf(
  sender: WebContents,
  input: ExportPdfInput,
): Promise<ExportPdfResult> {
  validateInput(input);
  const parentWindow = BrowserWindow.fromWebContents(sender);
  const options: SaveDialogOptions = {
    title: '导出文件考古报告',
    defaultPath: safeReportFilename(input.result.rootPath),
    buttonLabel: '导出 PDF',
    filters: [{ name: 'PDF 报告', extensions: ['pdf'] }],
    properties: ['showOverwriteConfirmation', 'createDirectory'],
  };
  const selection = parentWindow
    ? await dialog.showSaveDialog(parentWindow, options)
    : await dialog.showSaveDialog(options);
  if (selection.canceled || !selection.filePath) return { canceled: true };

  const outputPath = extname(selection.filePath).toLowerCase() === '.pdf'
    ? selection.filePath
    : `${selection.filePath}.pdf`;
  const pdf = await renderReportPdf(input);
  await writeFile(outputPath, pdf, { flag: 'w' });
  return { canceled: false, outputPath };
}
