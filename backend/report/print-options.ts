import type { PrintToPDFOptions } from 'electron';

const HEADER_TEMPLATE = `
  <div style="box-sizing:border-box;width:100%;padding:0 14mm;font-family:Arial,sans-serif;font-size:7px;color:#7b858b;display:flex;justify-content:space-between;">
    <span>FILE ARCHAEOLOGIST</span><span class="title"></span>
  </div>`;

const FOOTER_TEMPLATE = `
  <div style="box-sizing:border-box;width:100%;padding:0 14mm;font-family:Arial,'Microsoft YaHei',sans-serif;font-size:7px;color:#7b858b;display:flex;justify-content:space-between;">
    <span>推断结果仅供人工确认</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;

export const REPORT_PRINT_OPTIONS: PrintToPDFOptions = Object.freeze({
  landscape: false,
  displayHeaderFooter: true,
  printBackground: true,
  pageSize: 'A4',
  preferCSSPageSize: true,
  headerTemplate: HEADER_TEMPLATE,
  footerTemplate: FOOTER_TEMPLATE,
  generateTaggedPDF: true,
  generateDocumentOutline: true,
});
