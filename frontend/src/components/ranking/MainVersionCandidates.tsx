import { useMemo, useState } from 'react';
import { FileCheck2, Scale } from 'lucide-react';
import type { FileFamily } from '../../../../backend/contracts/family-clustering';
import type {
  MainVersionCandidate,
  MainVersionRanking,
  MainVersionScoreBreakdown,
} from '../../../../backend/contracts/main-version';
import type { RawFileMetadata } from '../../../../backend/contracts/scan';

const COPY = {
  title: '\u6b63\u5f0f\u7248\u672c\u5019\u9009',
  description: '\u5019\u9009\u662f\u57fa\u4e8e\u5143\u6570\u636e\u7684\u6392\u540d\uff0c\u4e0d\u662f\u5df2\u786e\u5b9a\u7684\u6b63\u5f0f\u7248\u672c\u3002',
  family: '\u9009\u62e9\u6587\u4ef6\u5bb6\u65cf',
  explanation: '\u5019\u9009\u8bc4\u5206\u4f9d\u636e',
  score: '\u7efc\u5408\u5f97\u5206',
  penalties: '\u60e9\u7f5a\u9879',
  warnings: '\u5f85\u786e\u8ba4\u63d0\u793a',
  noCandidate: '\u8be5\u5bb6\u65cf\u6ca1\u6709\u53ef\u5c55\u793a\u7684\u5019\u9009\u3002',
} as const;

const SCORE_LABELS: Record<keyof MainVersionScoreBreakdown, string> = {
  recencyScore: '\u8fd1\u671f\u6d3b\u8dc3',
  graphLeafScore: '\u53f6\u8282\u70b9\u4f4d\u7f6e',
  versionMarkerScore: '\u7248\u672c\u6807\u8bb0',
  directoryIntentScore: '\u76ee\u5f55\u610f\u56fe',
  branchCentralityScore: '\u5206\u652f\u4f4d\u7f6e',
  sizePlausibilityScore: '\u5927\u5c0f\u5408\u7406\u6027',
  userConfirmationScore: '\u7528\u6237\u786e\u8ba4',
};

export function MainVersionCandidates({
  ranking,
  families,
  files,
}: {
  ranking: MainVersionRanking;
  families: FileFamily[];
  files: RawFileMetadata[];
}) {
  const candidateFamilyIds = useMemo(
    () => [...new Set(ranking.candidates.map((candidate) => candidate.familyId))],
    [ranking.candidates],
  );
  const [familyId, setFamilyId] = useState(candidateFamilyIds[0] ?? '');
  const familyCandidates = ranking.candidates.filter((candidate) => candidate.familyId === familyId);
  const [selectedFileId, setSelectedFileId] = useState<string>();
  const selected =
    familyCandidates.find((candidate) => candidate.fileId === selectedFileId) ?? familyCandidates[0];
  const fileById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);
  const familyById = useMemo(
    () => new Map(families.map((family) => [family.id, family])),
    [families],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="flex flex-col justify-between gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 aria-hidden="true" className="text-primary" size={18} />
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
              setSelectedFileId(undefined);
            }}
          >
            {candidateFamilyIds.map((id) => (
              <option key={id} value={id}>
                {familyById.get(id)?.displayName ?? id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid min-h-[440px] lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.5fr)]">
        <div className="divide-y divide-border border-b border-border lg:border-b-0 lg:border-r">
          {familyCandidates.map((candidate) => {
            const file = fileById.get(candidate.fileId);
            const active = selected?.fileId === candidate.fileId;
            return (
              <button
                className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors ${
                  active ? 'bg-[#f2f7f9]' : 'hover:bg-[#fafbfb]'
                }`}
                key={candidate.fileId}
                type="button"
                onClick={() => setSelectedFileId(candidate.fileId)}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                  {candidate.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold" title={file?.name}>
                    {file?.name ?? candidate.fileId}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {candidate.confidenceText} · {Math.round(candidate.score * 100)}%
                  </span>
                </span>
              </button>
            );
          })}
          {familyCandidates.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{COPY.noCandidate}</p>
          ) : null}
        </div>

        <CandidateExplanation candidate={selected} file={selected ? fileById.get(selected.fileId) : undefined} />
      </div>

      <p className="border-t border-[#e6d7b8] bg-[#fffbf3] px-5 py-3 text-xs leading-5 text-[#725628]">
        {ranking.disclaimer}
      </p>
    </section>
  );
}

function CandidateExplanation({
  candidate,
  file,
}: {
  candidate?: MainVersionCandidate;
  file?: RawFileMetadata;
}) {
  if (!candidate) {
    return (
      <div className="grid place-items-center px-6 py-10 text-center text-sm text-muted-foreground">
        {COPY.noCandidate}
      </div>
    );
  }

  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold text-primary">{COPY.explanation}</p>
          <h3 className="mt-2 break-words font-semibold">{file?.name ?? candidate.fileId}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{candidate.confidenceText}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Scale aria-hidden="true" size={17} className="text-primary" />
          <span>{COPY.score}</span>
          <strong className="text-xl">{Math.round(candidate.score * 100)}%</strong>
        </div>
      </div>

      <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {Object.entries(candidate.scoreBreakdown).map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {SCORE_LABELS[key as keyof MainVersionScoreBreakdown]}
              </span>
              <strong>{Math.round(value * 100)}%</strong>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${value * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      {candidate.penalties.length > 0 ? (
        <div className="mt-6 border-t border-border pt-4">
          <h4 className="text-sm font-semibold">{COPY.penalties}</h4>
          <ul className="mt-2 space-y-2 text-xs text-[#7a4d35]">
            {candidate.penalties.map((penalty) => (
              <li className="flex justify-between gap-4" key={penalty.type}>
                <span>{penalty.description}</span>
                <strong>-{Math.round(penalty.value * 100)}%</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 border-t border-border pt-4">
        <h4 className="text-sm font-semibold">{COPY.warnings}</h4>
        <ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
          {candidate.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
