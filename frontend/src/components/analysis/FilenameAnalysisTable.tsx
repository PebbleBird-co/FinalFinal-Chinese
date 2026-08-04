import type { RawFileMetadata } from '../../../../backend/contracts/scan';

const LABELS = {
  title: '\u6587\u4ef6\u540d\u5206\u6790',
  description: '\u5c55\u793a\u672c\u5730\u89c4\u5219\u62c6\u5206\u7ed3\u679c\uff0c\u4e0d\u8868\u793a\u6587\u4ef6\u4e4b\u95f4\u5df2\u5efa\u7acb\u7248\u672c\u5173\u7cfb\u3002',
  original: '\u539f\u59cb\u6587\u4ef6\u540d',
  normalized: '\u6807\u51c6\u5316\u6587\u4ef6\u540d',
  core: '\u6838\u5fc3\u540d\u79f0',
  versions: '\u7248\u672c\u8bcd',
  dates: '\u65e5\u671f\u8bcd',
  numeric: '\u6570\u5b57\u7248\u672c',
  size: '\u6587\u4ef6\u5927\u5c0f',
  modified: '\u4fee\u6539\u65f6\u95f4',
  empty: '\u672a\u63d0\u53d6',
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function valueOrFallback(value: string): string {
  return value || LABELS.empty;
}

export function FilenameAnalysisTable({ files }: { files: RawFileMetadata[] }) {
  const visibleFiles = files.slice(0, 100);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold">{LABELS.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{LABELS.description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1320px] text-left text-sm">
          <thead className="bg-[#f7f9fa] text-xs text-muted-foreground">
            <tr>
              {[
                LABELS.original,
                LABELS.normalized,
                LABELS.core,
                LABELS.versions,
                LABELS.dates,
                LABELS.numeric,
                LABELS.size,
                LABELS.modified,
              ].map((label) => (
                <th className="px-4 py-3 font-medium" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleFiles.map((file) => {
              const versionTokens = file.analysis.versionTokens.map((token) => token.raw).join(', ');
              const dateTokens = file.analysis.dateTokens
                .map((token) =>
                  token.confidence === 'low' ? `${token.normalized} (low)` : token.normalized,
                )
                .join(', ');
              return (
                <tr key={file.absolutePath}>
                  <td className="max-w-[230px] px-4 py-3">
                    <span className="block truncate" title={file.name}>
                      {file.name}
                    </span>
                  </td>
                  <td className="max-w-[230px] px-4 py-3 text-muted-foreground">
                    <span className="block truncate" title={file.analysis.normalizedName}>
                      {file.analysis.normalizedName}
                    </span>
                  </td>
                  <td className="max-w-[180px] px-4 py-3">
                    {valueOrFallback(file.analysis.coreName)}
                  </td>
                  <td className="max-w-[180px] px-4 py-3 text-muted-foreground">
                    {valueOrFallback(versionTokens)}
                  </td>
                  <td className="max-w-[180px] px-4 py-3 text-muted-foreground">
                    {valueOrFallback(dateTokens)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {file.analysis.numericVersion?.join('.') ?? LABELS.empty}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatBytes(file.size)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {new Date(file.modifiedAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
