import {
  AlertTriangle,
  CalendarClock,
  FileCheck2,
  Files,
  FolderTree,
  Gauge,
} from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import type { ScanResult } from '../../../backend/contracts/scan';
import { EvidenceList } from '@/components/report/EvidenceList';
import { activityRange, confidenceText, formatDate, overallConfidence } from '@/lib/report';

export function OverviewPage() {
  const result = useOutletContext<ScanResult>();
  const fileById = new Map(result.files.map((file) => [file.id, file]));
  const confidence = overallConfidence(result);
  const range = activityRange(result);
  const topCandidates = result.mainVersions.candidates
    .filter((candidate) => candidate.rank === 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const highRisks = result.timeline.risks.filter((risk) => risk.severity === 'high').slice(0, 3);
  const extensions = [...result.files.reduce((counts, file) => {
    const key = file.extension.toLowerCase() || '无扩展名';
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maximumExtensionCount = Math.max(...extensions.map(([, count]) => count), 1);
  const mainCandidate = topCandidates[0];

  const metrics = [
    { label: '文件', value: result.files.length, icon: Files },
    { label: '可能的文件家族', value: result.clustering.families.length, icon: FolderTree },
    { label: '正式版本候选', value: result.mainVersions.candidates.length, icon: FileCheck2 },
    { label: '风险线索', value: result.timeline.risks.length, icon: AlertTriangle },
    { label: '整体置信度', value: `${Math.round(confidence * 100)}%`, icon: Gauge },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="项目概览指标">
        {metrics.map(({ label, value, icon: Icon }) => (
          <article className="rounded-xl border border-border bg-white p-4" key={label}>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs">{label}</span>
              <Icon aria-hidden="true" size={16} />
            </div>
            <p className="mt-3 text-2xl font-semibold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <p className="text-xs font-semibold text-primary">考古摘要</p>
        <h2 className="mt-2 text-xl font-semibold">
          现有元数据呈现出 {result.clustering.families.length} 个可能的文件家族
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">
          扫描共识别 {result.files.length.toLocaleString()} 个文件。
          {range.start && range.end
            ? ` 文件时间记录覆盖 ${formatDate(range.start)} 至 ${formatDate(range.end)}。`
            : ' 当前没有足够的时间记录用于判断活动范围。'}
          {mainCandidate
            ? ` 得分最高的正式版本候选为“${fileById.get(mainCandidate.fileId)?.name ?? mainCandidate.fileId}”，其置信度表述为“${mainCandidate.confidenceText}”。`
            : ' 当前没有达到展示条件的正式版本候选。'}
          {` 另有 ${result.timeline.risks.length} 项规则命中的风险线索需要人工确认。`}
        </p>
        <p className="mt-3 text-xs text-[#725628]">
          这是依据文件名、路径、大小和时间形成的推测摘要，不代表已还原真实版本历史。
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">正式版本候选</h2>
              <p className="mt-1 text-xs text-muted-foreground">每个家族的首位候选，按综合得分排序。</p>
            </div>
            <Link className="text-xs font-medium text-primary hover:underline" to="/report/families">查看家族图</Link>
          </div>
          {topCandidates.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">暂无可靠候选。</p>
          ) : (
            <div className="divide-y divide-border">
              {topCandidates.map((candidate, index) => {
                const file = fileById.get(candidate.fileId);
                return (
                  <article className="px-5 py-4" key={candidate.fileId}>
                    <div className="flex items-start gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-white">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <Link className="block truncate text-sm font-semibold hover:text-primary" to={`/report/files/${encodeURIComponent(candidate.fileId)}`} title={file?.name}>
                          {file?.name ?? candidate.fileId}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {candidate.confidenceText} · 综合得分 {Math.round(candidate.score * 100)}%
                        </p>
                        <EvidenceList evidence={candidate.evidence} label="展开候选证据" />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="border-t border-[#e6d7b8] bg-[#fffbf3] px-5 py-3 text-xs leading-5 text-[#725628]">{result.mainVersions.disclaimer}</p>
        </section>

        <section className="rounded-xl border border-border bg-white p-5">
          <h2 className="font-semibold">文件类型分布</h2>
          <p className="mt-1 text-xs text-muted-foreground">按扩展名统计，不读取文件内容。</p>
          <div className="mt-5 space-y-3">
            {extensions.map(([extension, count]) => (
              <div key={extension}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{extension === '无扩展名' ? extension : `.${extension}`}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(count / maximumExtensionCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2"><CalendarClock className="text-primary" aria-hidden="true" size={17} /><h2 className="font-semibold">关键时间事件</h2></div>
            <Link className="text-xs font-medium text-primary hover:underline" to="/report/timeline">完整时间线</Link>
          </div>
          {result.timeline.events.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">未检测到可靠事件。</p> : (
            <div className="divide-y divide-border">
              {result.timeline.events.slice(0, 4).map((event) => (
                <article className="px-5 py-4" key={event.id}>
                  <div className="flex justify-between gap-4"><h3 className="text-sm font-semibold">{event.title}</h3><time className="shrink-0 text-xs text-muted-foreground">{formatDate(event.startAt)}</time></div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{event.description}</p>
                  <EvidenceList evidence={event.evidence} label="展开事件证据" />
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2"><AlertTriangle className="text-[#9a6527]" aria-hidden="true" size={17} /><h2 className="font-semibold">高风险线索</h2></div>
            <Link className="text-xs font-medium text-primary hover:underline" to="/report/risks">全部风险</Link>
          </div>
          {highRisks.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">当前没有高风险规则命中。</p> : (
            <div className="divide-y divide-border">
              {highRisks.map((risk) => (
                <article className="px-5 py-4" key={risk.id}>
                  <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{risk.title}</h3><span className="rounded-md border border-[#e8c6bd] bg-[#fff6f3] px-2 py-1 text-[11px] font-semibold text-[#823f32]">高 · {Math.round(risk.confidence * 100)}%</span></div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{risk.description}</p>
                  <EvidenceList evidence={risk.evidence} label="展开风险依据" />
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <p className="text-center text-xs text-muted-foreground">整体置信度为 {Math.round(confidence * 100)}%，当前表述：{confidenceText(confidence)}。</p>
    </div>
  );
}
