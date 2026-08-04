import { app, BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import { buildReportHtml } from '../backend/report/report-template';
import { REPORT_PRINT_OPTIONS } from '../backend/report/print-options';
import { reportResult } from '../frontend/tests/fixtures/report-result';

async function main(): Promise<void> {
  const outputPath = process.argv.at(-1);
  if (!outputPath?.toLowerCase().endsWith('.pdf')) throw new Error('PDF QA output path is required.');
  const window = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    const html = buildReportHtml({ result: reportResult, overrideCount: 2 }, '2026-06-03T10:05:00.000Z');
    await window.loadURL(`data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`);
    await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    const pdf = await window.webContents.printToPDF(REPORT_PRINT_OPTIONS);
    await writeFile(outputPath, pdf, { flag: 'w' });
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error: unknown) => {
    console.error(error);
    app.exit(1);
  });
