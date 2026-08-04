import { AlertTriangle, Files, FolderTree } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import type { RiskSeverity } from '../../../backend/contracts/timeline-risk';
import type { ScanResult } from '../../../backend/contracts/scan';
import { EvidenceList } from '@/components/report/EvidenceList';

const groups: Array<{ severity: RiskSeverity; label: string; className: string }> = [
  { severity: 'high', label: '高风险', className: 'border-[#e8c6bd] bg-[#fff6f3] text-[#823f32]' },
  { severity: 'medium', label: '中风险', className: 'border-[#e8d6ad] bg-[#fffaf0] text-[#805c20]' },
  { severity: 'low', label: '低风险', className: 'border-[#cadbcf] bg-[#f4faf6] text-[#376149]' },
];

export function RisksPage() {
  const result = useOutletContext<ScanResult>();
  const fileById = new Map(result.files.map((file) => [file.id, file]));
  const familyById = new Map(result.clustering.families.map((family) => [family.id, family]));

  return (
    <div>
      <div className="mb-5">
        <p className="text-xs font-semibold text-primary">待人工确认</p>
        <h2 className="mt-1 text-xl font-semibold">风险线索</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          风险表示规则命中的异常线索，不表示文件已经出错，也不会触发任何自动整理操作。
        </p>
      </div>

      {result.timeline.risks.length === 0 ? (
        <section className="rounded-xl border border-border bg-white px-6 py-14 text-center">
          <AlertTriangle className="mx-auto text-[#4f8664]" aria-hidden="true" size={26} />
          <h3 className="mt-4 font-semibold">当前没有规则命中的风险线索</h3>
          <p className="mt-2 text-sm text-muted-foreground">这不代表项目不存在风险，仍建议人工核对重要文件。</p>
        </section>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const risks = result.timeline.risks.filter((risk) => risk.severity === group.severity);
            if (risks.length === 0) return null;
            return (
              <section key={group.severity}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${group.className}`}>{group.label}</span>
                  <span className="text-xs text-muted-foreground">{risks.length} 项待确认</span>
                </div>
                <div className="space-y-3">
                  {risks.map((risk) => (
                    <article className="rounded-xl border border-border bg-white p-5" key={risk.id}>
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <h3 className="font-semibold">{risk.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{risk.description}</p>
                        </div>
                        <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${group.className}`}>
                          置信度 {Math.round(risk.confidence * 100)}%
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-lg bg-muted/60 p-3">
                          <div className="flex items-center gap-2 text-xs font-semibold"><Files aria-hidden="true" size={14} />相关文件</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {risk.relatedFileIds.length === 0 ? <span className="text-xs text-muted-foreground">未关联具体文件</span> : null}
                            {risk.relatedFileIds.slice(0, 8).map((fileId) => (
                              <Link className="max-w-full truncate rounded-md border border-border bg-white px-2 py-1 text-xs hover:border-primary hover:text-primary" key={fileId} to={`/report/files/${encodeURIComponent(fileId)}`} title={fileById.get(fileId)?.relativePath}>
                                {fileById.get(fileId)?.name ?? fileId}
                              </Link>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-lg bg-[#fffbf3] p-3 text-sm leading-6 text-[#675638]">
                          <p className="text-xs font-semibold">建议人工动作</p>
                          <p className="mt-1">{risk.recommendation}</p>
                        </div>
                      </div>

                      <EvidenceList evidence={risk.evidence} label="展开判断依据" />
                      {risk.relatedFamilyIds.length > 0 ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <FolderTree aria-hidden="true" size={14} />
                          涉及家族：{risk.relatedFamilyIds.map((id) => familyById.get(id)?.displayName ?? id).join('、')}
                          <Link className="ml-auto font-medium text-primary hover:underline" to="/report/families">查看文件家族</Link>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
