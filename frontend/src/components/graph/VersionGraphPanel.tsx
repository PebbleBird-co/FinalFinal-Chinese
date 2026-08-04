import { useMemo, useState, type MouseEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import { AlertTriangle, GitFork, Scale, Star } from 'lucide-react';
import { EvidenceList } from '@/components/report/EvidenceList';
import type { FileFamily } from '../../../../backend/contracts/family-clustering';
import type { RawFileMetadata } from '../../../../backend/contracts/scan';
import type {
  SerializedVersionGraph,
  VersionEdge,
} from '../../../../backend/contracts/version-graph';

const COPY = {
  title: '\u7248\u672c\u5173\u7cfb\u56fe',
  description: '\u8fb9\u8868\u793a\u53ef\u80fd\u7684\u7248\u672c\u7ee7\u627f\u5173\u7cfb\uff0c\u4e0d\u662f\u5df2\u786e\u5b9a\u7684\u5386\u53f2\u4e8b\u5b9e\u3002',
  family: '\u9009\u62e9\u6587\u4ef6\u5bb6\u65cf',
  evidence: '\u8fb9\u8bc4\u5206\u4f9d\u636e',
  selectEdge: '\u70b9\u51fb\u56fe\u4e2d\u7684\u8fb9\uff0c\u67e5\u770b\u8be5\u5173\u7cfb\u7684\u8bc4\u5206\u660e\u7ec6\u3002',
  main: '\u4e3b\u7236\u8fb9',
  alternate: '\u5907\u9009\u7236\u8fb9',
  confidence: '\u7efc\u5408\u7f6e\u4fe1\u5ea6',
  inference: '\u9700\u8981\u4eba\u5de5\u786e\u8ba4',
  empty: '\u8be5\u5bb6\u65cf\u5f53\u524d\u53ea\u6709\u5355\u4e2a\u6587\u4ef6\uff0c\u6ca1\u6709\u53ef\u663e\u793a\u7684\u7ee7\u627f\u8fb9\u3002',
} as const;

const SCORE_LABELS = {
  nameSimilarity: '\u6587\u4ef6\u540d\u76f8\u4f3c\u5ea6',
  timeOrderScore: '\u65f6\u95f4\u987a\u5e8f',
  sizeContinuityScore: '\u5927\u5c0f\u8fde\u7eed\u6027',
  directoryRelationScore: '\u76ee\u5f55\u5173\u7cfb',
  versionProgressionScore: '\u7248\u672c\u8bcd\u6f14\u8fdb',
} as const;

const RELATION_LABELS = {
  likely_successor: '\u8f83\u53ef\u80fd\u7684\u540e\u7ee7\u7248\u672c',
  possible_successor: '\u53ef\u80fd\u7684\u540e\u7ee7\u7248\u672c',
  possible_branch: '\u53ef\u80fd\u7684\u7248\u672c\u5206\u652f',
  uncertain: '\u4e0d\u786e\u5b9a\u5173\u7cfb',
} as const;

function graphNode(
  node: SerializedVersionGraph['nodes'][number],
  file: RawFileMetadata | undefined,
  minimumY: number,
  candidateFileIds: Set<string>,
  riskFileIds: Set<string>,
): Node {
  return {
    id: node.id,
    position: { x: node.position.x, y: node.position.y - minimumY },
    draggable: false,
    selectable: true,
    data: {
      fileId: node.fileId,
      label: (
        <div className="min-w-[170px] text-left">
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold" title={node.label}>{node.label}</p>
            {candidateFileIds.has(node.fileId) ? <Star aria-label="正式版本候选" size={13} className="shrink-0 fill-[#c8963d] text-[#9a7436]" /> : null}
            {riskFileIds.has(node.fileId) ? <AlertTriangle aria-label="关联风险" size={13} className="shrink-0 text-[#a35142]" /> : null}
          </div>
          <p className="mt-1 text-[11px] text-[#66727b]">
            {new Date(node.modifiedAt).toLocaleString('zh-CN')}
          </p>
          {file?.analysis.versionTokens.length ? (
            <p className="mt-1 text-[11px] text-[#335b70]">
              {file.analysis.versionTokens.map((token) => token.raw).join(' / ')}
            </p>
          ) : null}
        </div>
      ),
    },
    style: {
      border: '1px solid #d7dee2',
      borderRadius: 8,
      background: '#ffffff',
      boxShadow: '0 4px 14px rgba(24, 39, 50, 0.07)',
      padding: '10px 12px',
      width: 210,
    },
  };
}

function graphEdge(edge: VersionEdge): Edge {
  const isBranch = edge.relation === 'possible_branch';
  const color = isBranch ? '#a66f25' : edge.role === 'main' ? '#315d73' : '#89949b';
  return {
    id: edge.id,
    source: `node:${edge.sourceFileId}`,
    target: `node:${edge.targetFileId}`,
    data: { versionEdgeId: edge.id },
    label: `${Math.round(edge.confidence * 100)}%`,
    markerEnd: { type: MarkerType.ArrowClosed, color },
    style: {
      stroke: color,
      strokeWidth: edge.role === 'main' ? 2 : 1.5,
      strokeDasharray: edge.role === 'alternate' ? '6 5' : undefined,
    },
    labelStyle: { fill: color, fontSize: 11, fontWeight: 600 },
    selectable: true,
    animated: false,
  };
}

export function VersionGraphPanel({
  graph,
  families,
  files,
  candidateFileIds = new Set<string>(),
  riskFileIds = new Set<string>(),
  onFileSelect,
}: {
  graph: SerializedVersionGraph;
  families: FileFamily[];
  files: RawFileMetadata[];
  candidateFileIds?: Set<string>;
  riskFileIds?: Set<string>;
  onFileSelect?: (fileId: string) => void;
}) {
  const initialFamilyId = families.find((family) => family.fileIds.length > 1)?.id ?? families[0]?.id ?? '';
  const [familyId, setFamilyId] = useState(initialFamilyId);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const fileById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);
  const familyNodes = graph.nodes.filter((node) => node.familyId === familyId);
  const minimumY = Math.min(...familyNodes.map((node) => node.position.y), 0);
  const nodes = useMemo(
    () => familyNodes.map((node) => graphNode(node, fileById.get(node.fileId), minimumY, candidateFileIds, riskFileIds)),
    [familyNodes, fileById, minimumY, candidateFileIds, riskFileIds],
  );
  const versionEdges = graph.edges.filter((edge) => edge.familyId === familyId);
  const edges = useMemo(() => versionEdges.map(graphEdge), [versionEdges]);
  const selectedEdge = graph.edges.find((edge) => edge.id === selectedEdgeId);

  const handleEdgeClick = (_event: MouseEvent, edge: Edge) => {
    setSelectedEdgeId(String(edge.data?.versionEdgeId ?? edge.id));
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white" aria-label={COPY.title}>
      <div className="flex flex-col justify-between gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <GitFork aria-hidden="true" className="text-primary" size={18} />
            <h2 className="font-semibold">{COPY.title}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{COPY.description}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{COPY.family}</span>
          <select
            className="h-9 max-w-[280px] rounded-md border border-border bg-white px-3 text-sm"
            value={familyId}
            onChange={(event) => {
              setFamilyId(event.target.value);
              setSelectedEdgeId(undefined);
            }}
          >
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.displayName} ({family.fileIds.length})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid min-h-[520px] lg:grid-cols-[minmax(0,2fr)_320px]">
        <div className="relative min-h-[420px] border-b border-border bg-[#fbfcfc] lg:border-b-0 lg:border-r">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.35}
            maxZoom={1.5}
            nodesConnectable={false}
            nodesDraggable={false}
            deleteKeyCode={null}
            onEdgeClick={handleEdgeClick}
            onNodeClick={(_event, node) => {
              const fileId = node.data.fileId;
              if (onFileSelect && typeof fileId === 'string') onFileSelect(fileId);
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d7dee2" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
          {versionEdges.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center text-sm text-muted-foreground">
              {COPY.empty}
            </div>
          ) : null}
        </div>

        <EdgeEvidence edge={selectedEdge} files={fileById} />
      </div>
    </section>
  );
}

function EdgeEvidence({
  edge,
  files,
}: {
  edge?: VersionEdge;
  files: Map<string, RawFileMetadata>;
}) {
  if (!edge) {
    return (
      <aside className="flex flex-col items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        <Scale aria-hidden="true" size={22} className="mb-3 text-primary" />
        <p>{COPY.selectEdge}</p>
      </aside>
    );
  }

  const source = files.get(edge.sourceFileId);
  const target = files.get(edge.targetFileId);
  return (
    <aside className="px-5 py-5" aria-label={COPY.evidence}>
      <p className="text-xs font-semibold text-primary">{COPY.inference}</p>
      <h3 className="mt-2 font-semibold">{COPY.evidence}</h3>
      <p className="mt-3 break-words text-sm leading-6">
        {source?.name ?? edge.sourceFileId}
        <span className="mx-2 text-muted-foreground">→</span>
        {target?.name ?? edge.targetFileId}
      </p>
      <div className="mt-4 flex items-center justify-between border-y border-border py-3 text-sm">
        <span>{edge.role === 'main' ? COPY.main : COPY.alternate}</span>
        <strong>{RELATION_LABELS[edge.relation]}</strong>
      </div>
      <div className="mt-4 space-y-3">
        {Object.entries(edge.scoreBreakdown).map(([key, value]) => (
          <div key={key}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {SCORE_LABELS[key as keyof typeof SCORE_LABELS]}
              </span>
              <strong>{Math.round(value * 100)}%</strong>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${value * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
        <span>{COPY.confidence}</span>
        <strong className="text-lg">{Math.round(edge.confidence * 100)}%</strong>
      </div>
      <EvidenceList evidence={edge.evidence} label="展开全部关系证据" />
    </aside>
  );
}
