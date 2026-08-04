import { ArrowLeft, FileCheck2, FileText, GitBranch, ShieldAlert, Trash2 } from 'lucide-react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import type { ScanResult } from '../../../backend/contracts/scan';
import { EvidenceList } from '@/components/report/EvidenceList';
import { CorrectionPanel } from '@/components/overrides/CorrectionPanel';
import { formatBytes, formatDateTime } from '@/lib/report';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project.store';

export function FileDetailPage() {
  const result = useOutletContext<ScanResult>();
  const { fileId = '' } = useParams();
  const decodedFileId = decodeURIComponent(fileId);
  const file = result.files.find((item) => item.id === decodedFileId);
  const applyOverride = useProjectStore((state) => state.applyOverride);
  const isApplyingOverride = useProjectStore((state) => state.isApplyingOverride);

  if (!file) {
    return (
      <section className="rounded-xl border border-border bg-white px-6 py-12 text-center">
        <h2 className="text-xl font-semibold">没有找到这个文件档案</h2>
        <p className="mt-2 text-sm text-muted-foreground">它可能不属于当前扫描结果。</p>
        <Link className="mt-5 inline-flex text-sm font-medium text-primary hover:underline" to="/report/overview">返回项目总览</Link>
      </section>
    );
  }

  const family = result.clustering.families.find((item) => item.fileIds.includes(file.id));
  const parentEdges = result.versionGraph.edges.filter((edge) => edge.targetFileId === file.id);
  const successorEdges = result.versionGraph.edges.filter((edge) => edge.sourceFileId === file.id);
  const fileById = new Map(result.files.map((item) => [item.id, item]));
  const candidate = result.mainVersions.candidates.find((item) => item.fileId === file.id);
  const risks = result.timeline.risks.filter((risk) => risk.relatedFileIds.includes(file.id));
  const relations = [...parentEdges, ...successorEdges];

  return (
    <div className="space-y-5">
      <Link className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" to="/report/families">
        <ArrowLeft aria-hidden="true" size={16} />返回文件家族
      </Link>

      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e5eef1] text-primary"><FileText aria-hidden="true" size={21} /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">单个文件调查档案</p>
            <h2 className="mt-1 break-words text-xl font-semibold">{file.name}</h2>
            <p className="mt-1 break-all text-xs text-muted-foreground">{file.relativePath}</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <Meta label="文件大小" value={formatBytes(file.size)} />
          <Meta label="修改时间" value={formatDateTime(file.modifiedAt)} />
          <Meta label="扩展名" value={file.extension ? `.${file.extension}` : '无扩展名'} />
          <Meta label="目录层级" value={`${file.directoryDepth} 层`} />
          <Meta label="标准化名称" value={file.analysis.normalizedName || '未提取'} />
          <Meta label="核心名称" value={file.analysis.coreName || '未提取'} />
          <Meta label="核心业务词" value={file.analysis.semanticTokens.join('、') || '未提取'} />
          <Meta label="版本词" value={file.analysis.versionTokens.map((token) => token.raw).join('、') || '未提取'} />
        </dl>
      </section>

      <CorrectionPanel file={file} result={result} />

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-white p-5">
          <div className="flex items-center gap-2"><GitBranch className="text-primary" aria-hidden="true" size={17} /><h3 className="font-semibold">可能的版本关系</h3></div>
          <RelationGroup title="可能父版本" edges={parentEdges} opposite="sourceFileId" fileById={fileById} isApplying={isApplyingOverride} onRemove={(edgeId) => applyOverride('remove_edge', [edgeId])} />
          <RelationGroup title="可能后继版本" edges={successorEdges} opposite="targetFileId" fileById={fileById} isApplying={isApplyingOverride} onRemove={(edgeId) => applyOverride('remove_edge', [edgeId])} />
          {relations.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">当前没有达到建边阈值的关系。</p> : null}
        </section>

        <section className="rounded-xl border border-border bg-white p-5">
          <div className="flex items-center gap-2"><FileCheck2 className="text-primary" aria-hidden="true" size={17} /><h3 className="font-semibold">家族与候选判断</h3></div>
          <div className="mt-4 rounded-lg bg-muted/60 p-3 text-sm">
            <p className="text-xs text-muted-foreground">所属家族</p>
            <p className="mt-1 font-medium">{family?.displayName ?? '未归入家族'}</p>
          </div>
          {candidate ? (
            <div className="mt-3 rounded-lg border border-primary/15 bg-primary/[0.04] p-3">
              <div className="flex justify-between gap-3 text-sm"><span>正式版本候选第 {candidate.rank} 名</span><strong>{Math.round(candidate.score * 100)}%</strong></div>
              <p className="mt-1 text-xs text-muted-foreground">{candidate.confidenceText}</p>
              <EvidenceList evidence={candidate.evidence} label="展开候选证据" />
            </div>
          ) : <p className="mt-3 text-sm text-muted-foreground">该文件未进入正式版本候选 Top 3。</p>}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-white p-5">
        <div className="flex items-center gap-2"><ShieldAlert className="text-[#9a6527]" aria-hidden="true" size={17} /><h3 className="font-semibold">相关风险</h3></div>
        {risks.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">当前没有直接关联此文件的风险线索。</p> : (
          <div className="mt-4 space-y-3">
            {risks.map((risk) => (
              <article className="rounded-lg border border-border p-3" key={risk.id}>
                <div className="flex justify-between gap-3"><h4 className="text-sm font-semibold">{risk.title}</h4><span className="text-xs text-muted-foreground">{Math.round(risk.confidence * 100)}%</span></div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{risk.description}</p>
                <EvidenceList evidence={risk.evidence} label="展开风险依据" />
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="rounded-lg border border-[#e6d7b8] bg-[#fffbf3] px-4 py-3 text-xs leading-5 text-[#725628]">
        此档案只展示基于元数据的推测，不读取正文，也不会修改、移动、重命名或删除原始文件。
      </p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>;
}

function RelationGroup({ title, edges, opposite, fileById, isApplying, onRemove }: {
  title: string;
  edges: ScanResult['versionGraph']['edges'];
  opposite: 'sourceFileId' | 'targetFileId';
  fileById: Map<string, ScanResult['files'][number]>;
  isApplying: boolean;
  onRemove: (edgeId: string) => Promise<boolean>;
}) {
  if (edges.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
      <div className="mt-2 space-y-2">
        {edges.map((edge) => {
          const relatedId = edge[opposite];
          return (
            <div className="rounded-lg border border-border p-3" key={edge.id}>
              <div className="flex items-start justify-between gap-3">
                <Link className="min-w-0 truncate text-sm font-medium hover:text-primary" to={`/report/files/${encodeURIComponent(relatedId)}`}>{fileById.get(relatedId)?.name ?? relatedId}</Link>
                <span className="shrink-0 text-xs text-muted-foreground">{Math.round(edge.confidence * 100)}%</span>
              </div>
              <EvidenceList evidence={edge.evidence} label="展开关系证据" />
              <Button className="mt-2 h-8 px-2 text-xs" variant="outline" disabled={isApplying} onClick={() => void onRemove(edge.id)}>
                <Trash2 aria-hidden="true" size={13} />删除这条推测边
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
