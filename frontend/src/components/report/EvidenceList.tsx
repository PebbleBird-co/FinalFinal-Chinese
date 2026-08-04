import { ChevronDown } from 'lucide-react';

interface EvidenceItem {
  type: string;
  description: string;
  value?: number | string;
  impact: 'positive' | 'negative' | 'neutral';
}

export function EvidenceList({
  evidence,
  label = '查看判断依据',
}: {
  evidence: EvidenceItem[];
  label?: string;
}) {
  return (
    <details className="group mt-3 rounded-lg border border-border bg-[#fbfcfc]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-primary">
        <span>{label}（{evidence.length}）</span>
        <ChevronDown className="transition-transform group-open:rotate-180" aria-hidden="true" size={15} />
      </summary>
      <ul className="space-y-2 border-t border-border px-3 py-3 text-xs leading-5 text-muted-foreground">
        {evidence.length === 0 ? <li>当前没有更多结构化证据。</li> : null}
        {evidence.map((item, index) => (
          <li className="flex gap-2" key={`${item.type}-${item.description}-${index}`}>
            <span
              className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                item.impact === 'positive'
                  ? 'bg-[#4f8664]'
                  : item.impact === 'negative'
                    ? 'bg-[#b25f4b]'
                    : 'bg-[#88949b]'
              }`}
              aria-hidden="true"
            />
            <span>
              {item.description}
              {item.value !== undefined ? `（${String(item.value)}）` : ''}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
