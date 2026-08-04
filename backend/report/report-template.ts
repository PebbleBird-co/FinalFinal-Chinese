import type { MainVersionCandidate } from '../contracts/main-version';
import type { ExportPdfInput } from '../contracts/report';
import type { ScanResult } from '../contracts/scan';

const MAX_CANDIDATES = 3;
const MAX_EVENTS = 30;
const MAX_RISKS = 50;
const MAX_FAMILIES = 100;
const MAX_ACTIVITY_BARS = 48;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function projectName(rootPath: string): string {
  return rootPath.replace(/[\\/]+$/u, '').split(/[\\/]/u).at(-1) || '未命名项目';
}

export function safeReportFilename(rootPath: string): string {
  const printableName = [...projectName(rootPath)]
    .map((character) => character.charCodeAt(0) < 32 ? '-' : character)
    .join('');
  const safe = printableName
    .replace(/[<>:"/\\|?*]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 60);
  return `${safe || '未命名项目'}-文件考古报告.pdf`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无可靠时间';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无可靠时间';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function activityRange(result: ScanResult): { start?: string; end?: string } {
  const values = result.files
    .map((file) => file.modifiedAt)
    .filter((value) => !Number.isNaN(Date.parse(value)))
    .sort();
  return { start: values[0], end: values.at(-1) };
}

function overallConfidence(result: ScanResult): number {
  const values = [
    ...result.clustering.families.filter((family) => family.fileIds.length > 1).map((family) => family.confidence),
    ...result.mainVersions.candidates.map((candidate) => candidate.confidence),
    ...result.timeline.events.map((event) => event.confidence),
    ...result.timeline.risks.map((risk) => risk.confidence),
  ];
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function confidencePhrase(value: number): string {
  if (value >= 0.85) return '高度可能';
  if (value >= 0.7) return '较可能';
  if (value >= 0.55) return '存在一定可能';
  if (value >= 0.4) return '存在弱迹象';
  return '无法可靠判断';
}

function evidenceList(evidence: Array<{ description: string; value?: number | string }>): string {
  if (evidence.length === 0) return '<p class="muted small">当前没有更多结构化依据。</p>';
  return `<ul class="evidence">${evidence.slice(0, 4).map((item) =>
    `<li>${escapeHtml(item.description)}${item.value === undefined ? '' : ` <span>(${escapeHtml(item.value)})</span>`}</li>`,
  ).join('')}</ul>`;
}

function omissionNote(total: number, visible: number, label: string): string {
  const omitted = total - visible;
  return omitted > 0
    ? `<p class="omission">为保持报告可读性，其余 ${omitted} ${label}未在打印版中展开；应用内仍保留完整结果。</p>`
    : '';
}

function topCandidates(result: ScanResult): MainVersionCandidate[] {
  return result.mainVersions.candidates
    .filter((candidate) => candidate.rank === 1)
    .sort((left, right) => right.score - left.score || left.fileId.localeCompare(right.fileId))
    .slice(0, MAX_CANDIDATES);
}

function summaryHtml(result: ScanResult, candidates: MainVersionCandidate[]): string {
  const range = activityRange(result);
  const startEvent = result.timeline.events.find((event) => event.type === 'project_start');
  const branchEvent = result.timeline.events.find((event) => event.type === 'branch_created');
  const firstCandidate = candidates[0];
  const fileById = new Map(result.files.map((file) => [file.id, file]));
  return `
    <p>扫描到 <strong>${result.files.length.toLocaleString('zh-CN')}</strong> 个文件，识别出 <strong>${result.clustering.families.length.toLocaleString('zh-CN')}</strong> 个可能的文件家族。</p>
    <p>${startEvent
      ? `现有元数据显示，项目可能在 ${escapeHtml(formatDate(startEvent.startAt))} 前后开始活跃。`
      : range.start
        ? `现有文件时间记录最早可追溯至 ${escapeHtml(formatDate(range.start))}；这不代表项目一定始于该日。`
        : '当前没有足够的时间元数据用于推测项目起点。'} ${branchEvent
      ? `在 ${escapeHtml(formatDate(branchEvent.startAt))} 前后存在可能的版本分支迹象。`
      : '当前规则没有识别出足够可靠的分支形成事件。'}</p>
    <p>${firstCandidate
      ? `当前得分最高的正式版本候选是“${escapeHtml(fileById.get(firstCandidate.fileId)?.name ?? firstCandidate.fileId)}”，判断为“${escapeHtml(firstCandidate.confidenceText)}”。`
      : '当前没有达到展示条件的正式版本候选。'} 另有 <strong>${result.timeline.risks.length}</strong> 项风险线索值得人工确认。</p>
  `;
}

function candidateSection(result: ScanResult, candidates: MainVersionCandidate[]): string {
  const fileById = new Map(result.files.map((file) => [file.id, file]));
  const familyById = new Map(result.clustering.families.map((family) => [family.id, family]));
  if (candidates.length === 0) return '<div class="empty">当前没有可展示的正式版本候选。</div>';
  return candidates.map((candidate, index) => {
    const file = fileById.get(candidate.fileId);
    return `
      <article class="card candidate-card">
        <div class="rank">${index + 1}</div>
        <div class="card-body">
          <div class="row between"><h3>${escapeHtml(file?.name ?? candidate.fileId)}</h3><strong class="score">${Math.round(candidate.score * 100)}%</strong></div>
          <p class="meta">${escapeHtml(familyById.get(candidate.familyId)?.displayName ?? candidate.familyId)} · ${escapeHtml(candidate.confidenceText)} · ${candidate.confidence === 1 ? '用户确认' : '系统推测'}</p>
          <p class="path">${escapeHtml(file?.relativePath ?? '')}</p>
          <h4>判断依据</h4>${evidenceList(candidate.evidence)}
        </div>
      </article>`;
  }).join('');
}

function sampleActivity<T>(values: T[], maximum: number): T[] {
  if (values.length <= maximum) return values;
  return Array.from({ length: maximum }, (_, index) =>
    values[Math.round((index * (values.length - 1)) / (maximum - 1))],
  );
}

function timelineSection(result: ScanResult): string {
  const days = sampleActivity(result.timeline.dailyActivity, MAX_ACTIVITY_BARS);
  const maximum = Math.max(...days.map((day) => day.fileCount), 1);
  const bars = days.map((day) => {
    const height = Math.max(2, Math.round((day.fileCount / maximum) * 46));
    return `<span class="bar" style="height:${height}px" title="${escapeHtml(day.date)}: ${day.fileCount}"></span>`;
  }).join('');
  const events = result.timeline.events.slice(0, MAX_EVENTS);
  return `
    <div class="activity-block">
      <div class="row between"><strong>文件活动量</strong><span class="muted small">${result.timeline.dailyActivity.length} 个活动日 · 峰值 ${maximum} 个文件</span></div>
      <div class="bars">${bars || '<span class="muted small">暂无活动数据</span>'}</div>
      <div class="row between muted tiny"><span>${days[0]?.date ?? ''}</span><span>${days.at(-1)?.date ?? ''}</span></div>
    </div>
    <div class="timeline-list">${events.length === 0 ? '<div class="empty">未检测到可靠的项目事件。</div>' : events.map((event) => `
      <article class="timeline-item">
        <div class="timeline-date">${escapeHtml(formatDate(event.startAt))}</div>
        <div><div class="row between"><h3>${escapeHtml(event.title)}</h3><span class="confidence">${Math.round(event.confidence * 100)}%</span></div>
        <p>${escapeHtml(event.description)}</p>${evidenceList(event.evidence)}</div>
      </article>`).join('')}</div>
    ${omissionNote(result.timeline.events.length, events.length, '项事件')}
  `;
}

function riskSection(result: ScanResult): string {
  const labels = { high: '高', medium: '中', low: '低' } as const;
  const risks = result.timeline.risks.slice(0, MAX_RISKS);
  if (risks.length === 0) return '<div class="empty">当前没有规则命中的风险线索；这不代表项目不存在风险。</div>';
  return `${risks.map((risk) => `
    <article class="card risk-card">
      <div class="row between"><h3>${escapeHtml(risk.title)}</h3><span class="severity ${risk.severity}">${labels[risk.severity]} · ${Math.round(risk.confidence * 100)}%</span></div>
      <p>${escapeHtml(risk.description)}</p>
      <div class="recommendation"><strong>建议人工动作：</strong>${escapeHtml(risk.recommendation)}</div>
      <h4>判断依据</h4>${evidenceList(risk.evidence)}
    </article>`).join('')}${omissionNote(result.timeline.risks.length, risks.length, '项风险')}`;
}

function familySection(result: ScanResult): string {
  const families = [...result.clustering.families]
    .sort((left, right) => right.fileIds.length - left.fileIds.length || left.displayName.localeCompare(right.displayName))
    .slice(0, MAX_FAMILIES);
  return `
    <table><thead><tr><th>文件家族</th><th class="number">文件数</th><th class="number">聚类置信度</th></tr></thead>
    <tbody>${families.map((family) => `<tr><td><strong>${escapeHtml(family.displayName)}</strong><div class="muted tiny">${escapeHtml(family.coreName)}</div></td><td class="number">${family.fileIds.length}</td><td class="number">${family.fileIds.length === 1 ? '不适用' : `${Math.round(family.confidence * 100)}%`}</td></tr>`).join('')}</tbody></table>
    ${omissionNote(result.clustering.families.length, families.length, '个家族')}
  `;
}

function extensionRows(result: ScanResult): string {
  const values = [...result.files.reduce((counts, file) => {
    const extension = file.extension.toLowerCase() || '无扩展名';
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())].sort((left, right) => right[1] - left[1]).slice(0, 10);
  const maximum = Math.max(...values.map(([, count]) => count), 1);
  return values.map(([extension, count]) => `
    <div class="distribution-row"><span>${extension === '无扩展名' ? extension : `.${escapeHtml(extension)}`}</span><span class="distribution-bar"><i style="width:${Math.round((count / maximum) * 100)}%"></i></span><strong>${count}</strong></div>
  `).join('') || '<div class="empty">暂无文件类型数据。</div>';
}

export function buildReportHtml(input: ExportPdfInput, generatedAt = new Date().toISOString()): string {
  const { result, overrideCount } = input;
  const name = projectName(result.rootPath);
  const range = activityRange(result);
  const confidence = overallConfidence(result);
  const candidates = topCandidates(result);
  const highRiskCount = result.timeline.risks.filter((risk) => risk.severity === 'high').length;
  return `<!doctype html>
  <html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
  <title>${escapeHtml(name)} - 文件考古报告</title><style>
    @page { size: A4; margin: 16mm 14mm 18mm; }
    * { box-sizing: border-box; }
    html { color: #182732; font-family: "Microsoft YaHei", "Noto Sans CJK SC", "PingFang SC", Arial, sans-serif; font-size: 10.5pt; line-height: 1.55; }
    body { margin: 0; background: #fff; }
    h1,h2,h3,h4,p { margin-top: 0; }
    h1 { font-size: 27pt; line-height: 1.22; letter-spacing: 0; margin-bottom: 5mm; }
    h2 { font-size: 18pt; line-height: 1.25; letter-spacing: 0; margin-bottom: 5mm; }
    h3 { font-size: 11.5pt; line-height: 1.35; letter-spacing: 0; margin-bottom: 1.5mm; }
    h4 { font-size: 9pt; margin: 3mm 0 1mm; color: #315d73; }
    p { margin-bottom: 2.5mm; }
    .cover { min-height: 242mm; display: flex; flex-direction: column; page-break-after: always; }
    .brand { display: flex; align-items: center; gap: 3mm; color: #315d73; font-weight: 700; }
    .brand-mark { display: inline-grid; place-items: center; width: 10mm; height: 10mm; border-radius: 2mm; color: #fff; background: #315d73; font-size: 8pt; }
    .cover-main { margin-top: 32mm; max-width: 155mm; }
    .eyebrow { color: #315d73; font-size: 9pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .lead { color: #52636d; font-size: 12pt; line-height: 1.7; }
    .trust { margin-top: 7mm; padding: 4mm; border-left: 1.5mm solid #b88a3d; background: #fffbf3; color: #675638; font-weight: 700; }
    .cover-meta { margin-top: auto; border-top: 1px solid #d7dee2; padding-top: 5mm; display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 8mm; }
    .cover-meta dt { color: #69757d; font-size: 8pt; }
    .cover-meta dd { margin: 1mm 0 0; font-weight: 600; word-break: break-all; }
    .section { page-break-before: always; }
    .section-kicker { color: #315d73; font-size: 8pt; font-weight: 700; letter-spacing: .08em; }
    .section-intro { color: #69757d; margin-bottom: 6mm; }
    .metric-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2.5mm; margin: 5mm 0 7mm; }
    .metric { border: 1px solid #d7dee2; padding: 3mm; border-radius: 2mm; }
    .metric span { display: block; color: #69757d; font-size: 7.5pt; }
    .metric strong { display: block; margin-top: 1.5mm; font-size: 17pt; line-height: 1; }
    .summary { padding: 5mm; background: #f5f8f9; border-left: 1.5mm solid #315d73; }
    .summary p:last-child { margin-bottom: 0; }
    .two-column { display: grid; grid-template-columns: 1.1fr .9fr; gap: 6mm; margin-top: 7mm; }
    .panel { border: 1px solid #d7dee2; border-radius: 2mm; padding: 4mm; break-inside: avoid; }
    .distribution-row { display: grid; grid-template-columns: 23mm 1fr 12mm; gap: 2mm; align-items: center; margin-top: 2mm; font-size: 8.5pt; }
    .distribution-bar { height: 2.5mm; background: #edf0f2; border-radius: 1mm; overflow: hidden; }
    .distribution-bar i { display: block; height: 100%; background: #315d73; }
    .card { border: 1px solid #d7dee2; border-radius: 2mm; padding: 4mm; margin-bottom: 3mm; break-inside: avoid; }
    .candidate-card { display: grid; grid-template-columns: 9mm 1fr; gap: 3mm; }
    .rank { display: grid; place-items: center; width: 8mm; height: 8mm; border-radius: 2mm; background: #315d73; color: #fff; font-weight: 700; }
    .row { display: flex; align-items: baseline; gap: 3mm; }
    .between { justify-content: space-between; }
    .score { color: #315d73; font-size: 14pt; }
    .meta,.path,.muted { color: #69757d; }
    .path { font-size: 8pt; word-break: break-all; }
    .small { font-size: 8.5pt; }
    .tiny { font-size: 7.5pt; }
    .evidence { margin: 1mm 0 0; padding-left: 5mm; color: #52636d; font-size: 8.5pt; }
    .evidence li { margin-bottom: .8mm; }
    .evidence span { color: #7b858b; }
    .activity-block { padding: 4mm; border: 1px solid #d7dee2; border-radius: 2mm; margin-bottom: 5mm; break-inside: avoid; }
    .bars { height: 52px; display: flex; align-items: flex-end; gap: 1px; border-bottom: 1px solid #d7dee2; margin-top: 4mm; }
    .bar { flex: 1; min-width: 1px; max-width: 8px; background: #567f92; border-radius: 1px 1px 0 0; }
    .timeline-item { display: grid; grid-template-columns: 28mm 1fr; gap: 4mm; padding: 3.5mm 0; border-bottom: 1px solid #e5eaec; break-inside: avoid; }
    .timeline-date { color: #315d73; font-weight: 700; font-size: 8.5pt; }
    .confidence { color: #315d73; font-size: 8pt; font-weight: 700; }
    .risk-card { border-left-width: 1.5mm; border-left-color: #b88a3d; }
    .severity { border: 1px solid; border-radius: 1.5mm; padding: .6mm 1.8mm; font-size: 7.5pt; font-weight: 700; }
    .severity.high { color: #823f32; border-color: #e8c6bd; background: #fff6f3; }
    .severity.medium { color: #805c20; border-color: #e8d6ad; background: #fffaf0; }
    .severity.low { color: #376149; border-color: #cadbcf; background: #f4faf6; }
    .recommendation { margin-top: 3mm; padding: 3mm; background: #fffbf3; color: #675638; font-size: 8.5pt; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th { background: #f2f5f6; color: #52636d; text-align: left; }
    th,td { border-bottom: 1px solid #d7dee2; padding: 2.5mm; vertical-align: top; }
    .number { text-align: right; white-space: nowrap; }
    .limits { border: 1px solid #d7dee2; border-radius: 2mm; padding: 5mm; }
    .limits li { margin-bottom: 2mm; }
    .omission { margin-top: 4mm; padding: 3mm; background: #f5f8f9; color: #52636d; font-size: 8pt; }
    .empty { padding: 8mm; border: 1px dashed #b9c4c9; color: #69757d; text-align: center; }
  </style></head><body>
    <section class="cover">
      <div class="brand"><span class="brand-mark">FA</span><span>文件考古学家 · File Archaeologist</span></div>
      <div class="cover-main"><p class="eyebrow">本地只读调查报告</p><h1>${escapeHtml(name)}</h1>
        <p class="lead">依据文件名、目录关系、大小与时间元数据，推测项目可能的版本演化、文件家族、正式版本候选和风险线索。</p>
        <div class="trust">推断结果仅供人工确认。报告不包含文件正文，也不代表已经还原真实项目历史。</div>
      </div>
      <dl class="cover-meta">
        <div><dt>调查目录</dt><dd>${escapeHtml(result.rootPath)}</dd></div>
        <div><dt>扫描时间</dt><dd>${escapeHtml(formatDateTime(result.scannedAt))}</dd></div>
        <div><dt>活动时间范围</dt><dd>${range.start && range.end ? `${escapeHtml(formatDate(range.start))} - ${escapeHtml(formatDate(range.end))}` : '暂无可靠时间'}</dd></div>
        <div><dt>报告生成时间</dt><dd>${escapeHtml(formatDateTime(generatedAt))}</dd></div>
      </dl>
    </section>

    <section><p class="section-kicker">01 · PROJECT OVERVIEW</p><h2>项目摘要</h2>
      <div class="metric-grid">
        <div class="metric"><span>文件数</span><strong>${result.files.length}</strong></div>
        <div class="metric"><span>可能家族</span><strong>${result.clustering.families.length}</strong></div>
        <div class="metric"><span>候选数</span><strong>${result.mainVersions.candidates.length}</strong></div>
        <div class="metric"><span>风险线索</span><strong>${result.timeline.risks.length}</strong></div>
        <div class="metric"><span>整体置信度</span><strong>${Math.round(confidence * 100)}%</strong></div>
      </div>
      <div class="summary">${summaryHtml(result, candidates)}</div>
      <div class="two-column">
        <div class="panel"><h3>判断概况</h3><p>整体置信度当前表述为“${confidencePhrase(confidence)}”。其中高风险线索 ${highRiskCount} 项，用户纠正 ${overrideCount} 条。</p><p class="muted small">置信度表示规则与现有元数据的一致程度，不代表结论真实性。</p></div>
        <div class="panel"><h3>文件类型分布</h3>${extensionRows(result)}</div>
      </div>
    </section>

    <section class="section"><p class="section-kicker">02 · MAIN VERSION CANDIDATES</p><h2>正式版本候选</h2><p class="section-intro">候选来自结构化评分与用户纠正，不是已经确定的正式版本。</p>${candidateSection(result, candidates)}<p class="omission">${escapeHtml(result.mainVersions.disclaimer)}</p></section>
    <section class="section"><p class="section-kicker">03 · ACTIVITY TIMELINE</p><h2>项目时间线</h2><p class="section-intro">时间线仅依据文件时间元数据生成；复制、恢复或迁移可能造成时间失真。</p>${timelineSection(result)}</section>
    <section class="section"><p class="section-kicker">04 · RISK CLUES</p><h2>风险线索</h2><p class="section-intro">风险是规则命中的待确认线索，不表示已经发生误操作。</p>${riskSection(result)}</section>
    <section class="section"><p class="section-kicker">05 · FILE FAMILIES</p><h2>文件家族摘要</h2><p class="section-intro">家族仅根据文件名和元数据保守聚类，仍需人工核对。</p>${familySection(result)}</section>
    <section class="section"><p class="section-kicker">06 · INFERENCE LIMITS</p><h2>推断限制说明</h2>
      <div class="limits"><ul>
        <li><strong>推断结果仅供人工确认。</strong>“可能”“较可能”“候选”等措辞不表示确定事实。</li>
        <li>分析只使用文件名、路径、扩展名、大小、目录结构与时间元数据，不读取 DOCX、PDF、PPTX 或其他文件正文。</li>
        <li>修改时间可能因复制、恢复、压缩解压、同步或系统迁移而失真。</li>
        <li>文件名中的“最终”“定稿”或“提交”只作为弱证据，不能单独证明正式版本。</li>
        <li>用户纠正只修改本地报告，不会移动、重命名、覆盖或删除原始文件。</li>
        <li>本报告在本机生成，不调用外部 AI API，不上传文件或元数据。</li>
      </ul></div>
      <div class="trust">请结合交付记录、项目沟通和业务背景完成最终判断。</div>
    </section>
  </body></html>`;
}
