import { useNavigate, useOutletContext } from 'react-router-dom';
import type { ScanResult } from '../../../backend/contracts/scan';
import { VersionGraphPanel } from '@/components/graph/VersionGraphPanel';

export function FamilyTreePage() {
  const result = useOutletContext<ScanResult>();
  const navigate = useNavigate();
  return (
    <div>
      <div className="mb-5">
        <p className="text-xs font-semibold text-primary">关系调查</p>
        <h2 className="mt-1 text-xl font-semibold">文件家族树</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          选择家族查看可能的版本继承关系。点击节点进入文件档案，点击连线查看评分与证据。
        </p>
      </div>
      <VersionGraphPanel
        graph={result.versionGraph}
        families={result.clustering.families}
        files={result.files}
        candidateFileIds={new Set(result.mainVersions.candidates.map((candidate) => candidate.fileId))}
        riskFileIds={new Set(result.timeline.risks.flatMap((risk) => risk.relatedFileIds))}
        onFileSelect={(fileId) => navigate(`/report/files/${encodeURIComponent(fileId)}`)}
      />
    </div>
  );
}
