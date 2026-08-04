import { GitBranch, Link2 } from 'lucide-react';
import type { FamilyClusteringResult } from '../../../../backend/contracts/family-clustering';
import type { RawFileMetadata } from '../../../../backend/contracts/scan';

const COPY = {
  title: '\u6587\u4ef6\u5bb6\u65cf\u63a8\u6d4b',
  description: '\u4ec5\u6839\u636e\u6587\u4ef6\u540d\u4e0e\u5143\u6570\u636e\u805a\u7c7b\uff0c\u7ed3\u679c\u9700\u8981\u4eba\u5de5\u786e\u8ba4\u3002',
  families: '\u5bb6\u65cf',
  groupedFiles: '\u5df2\u805a\u7c7b\u6587\u4ef6',
  weakRelations: '\u5f85\u786e\u8ba4\u5f31\u5173\u7cfb',
  candidatePairs: '\u5019\u9009\u6bd4\u8f83',
  confidence: '\u805a\u7c7b\u7f6e\u4fe1\u5ea6',
  files: '\u4e2a\u6587\u4ef6',
  singleton: '\u5355\u6587\u4ef6\u5bb6\u65cf',
  notApplicable: '\u4e0d\u9002\u7528',
} as const;

export function FamilySummary({
  clustering,
  files,
}: {
  clustering: FamilyClusteringResult;
  files: RawFileMetadata[];
}) {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const groupedFiles = clustering.families.reduce(
    (count, family) => count + (family.fileIds.length > 1 ? family.fileIds.length : 0),
    0,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="flex flex-col justify-between gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch aria-hidden="true" className="text-primary" size={18} />
            <h2 className="font-semibold">{COPY.title}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{COPY.description}</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span>
            <strong>{clustering.families.length}</strong> {COPY.families}
          </span>
          <span>
            <strong>{groupedFiles}</strong> {COPY.groupedFiles}
          </span>
          <span className={clustering.weakRelations.length > 0 ? 'text-[#8a6529]' : ''}>
            <strong>{clustering.weakRelations.length}</strong> {COPY.weakRelations}
          </span>
          <span className="text-muted-foreground">
            {clustering.candidatePairCount.toLocaleString()} {COPY.candidatePairs}
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {clustering.families.slice(0, 50).map((family) => {
          const memberNames = family.fileIds
            .map((fileId) => fileById.get(fileId)?.name)
            .filter((name) => name !== undefined);
          return (
            <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(180px,0.8fr)_minmax(0,2fr)_140px]" key={family.id}>
              <div>
                <p className="truncate font-medium" title={family.displayName}>
                  {family.displayName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {family.fileIds.length === 1
                    ? COPY.singleton
                    : `${family.fileIds.length} ${COPY.files}`}
                </p>
              </div>
              <p className="break-words text-sm leading-6 text-muted-foreground">
                {memberNames.join('  /  ')}
              </p>
              <div className="flex items-center gap-2 text-sm md:justify-end">
                <Link2 aria-hidden="true" size={15} className="text-primary" />
                <span>{COPY.confidence}</span>
                <strong>
                  {family.fileIds.length === 1
                    ? COPY.notApplicable
                    : `${Math.round(family.confidence * 100)}%`}
                </strong>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
