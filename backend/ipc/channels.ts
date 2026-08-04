export const IPC_CHANNELS = Object.freeze({
  selectDirectory: 'scan:select-directory',
  authorizeDroppedDirectory: 'scan:authorize-dropped-directory',
  scanDirectory: 'scan:directory',
  cancelScan: 'scan:cancel',
  scanProgress: 'scan:progress',
  analyzeProject: 'project:analyze',
  saveProjectState: 'project:save-state',
  loadProjectState: 'project:load-state',
  exportPdf: 'report:export-pdf',
});
