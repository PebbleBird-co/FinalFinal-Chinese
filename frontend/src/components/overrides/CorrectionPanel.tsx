import { useMemo, useState } from 'react';
import {
  ArchiveX,
  CheckCircle2,
  Copy,
  GitMerge,
  Link2,
  LoaderCircle,
  Scissors,
} from 'lucide-react';
import type { ScanResult } from '../../../../backend/contracts/scan';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project.store';

export function CorrectionPanel({ file, result }: {
  file: ScanResult['files'][number];
  result: ScanResult;
}) {
  const { applyOverride, history, isApplyingOverride } = useProjectStore();
  const family = result.clustering.families.find((item) => item.fileIds.includes(file.id));
  const otherFamilies = result.clustering.families.filter((item) => item.id !== family?.id);
  const parentOptions = (family?.fileIds ?? [])
    .filter((id) => id !== file.id)
    .map((id) => result.files.find((item) => item.id === id))
    .filter((item): item is ScanResult['files'][number] => item !== undefined);
  const [parentId, setParentId] = useState(parentOptions[0]?.id ?? '');
  const [mergeFamilyId, setMergeFamilyId] = useState(otherFamilies[0]?.id ?? '');
  const selectedParentId = parentOptions.some((item) => item.id === parentId)
    ? parentId
    : (parentOptions[0]?.id ?? '');
  const selectedMergeFamilyId = otherFamilies.some((item) => item.id === mergeFamilyId)
    ? mergeFamilyId
    : (otherFamilies[0]?.id ?? '');

  const effective = useMemo(() => {
    const latestStatus = [...history.present]
      .reverse()
      .find((item) =>
        item.targetIds.includes(file.id) &&
        ['set_main_version', 'mark_abandoned', 'mark_as_copy'].includes(item.type),
      );
    return {
      main: latestStatus?.type === 'set_main_version',
      abandoned: latestStatus?.type === 'mark_abandoned',
      copy: latestStatus?.type === 'mark_as_copy',
    };
  }, [file.id, history.present]);

  return (
    <section className="rounded-xl border border-primary/20 bg-white p-5 sm:p-6" aria-label="修正分析报告">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-primary">用户纠正</p>
          <h3 className="mt-1 font-semibold">修正系统对这个文件的推测</h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">操作会立即重算家族树、正式版本候选、事件与风险，并保存在本机应用数据中。</p>
        </div>
        {isApplyingOverride ? <LoaderCircle className="shrink-0 animate-spin text-primary" aria-label="正在应用纠正" size={20} /> : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Button
          variant={effective.main ? 'default' : 'outline'}
          disabled={isApplyingOverride || effective.main}
          onClick={() => void applyOverride('set_main_version', [file.id])}
        >
          <CheckCircle2 aria-hidden="true" size={16} />{effective.main ? '已设为主版本' : '设为主版本'}
        </Button>
        <Button
          variant={effective.abandoned ? 'default' : 'outline'}
          disabled={isApplyingOverride || effective.abandoned}
          onClick={() => void applyOverride('mark_abandoned', [file.id])}
        >
          <ArchiveX aria-hidden="true" size={16} />{effective.abandoned ? '已标记废弃' : '标记为废弃'}
        </Button>
        <Button
          variant={effective.copy ? 'default' : 'outline'}
          disabled={isApplyingOverride || effective.copy}
          onClick={() => void applyOverride('mark_as_copy', [file.id])}
        >
          <Copy aria-hidden="true" size={16} />{effective.copy ? '已标记副本' : '标记为副本'}
        </Button>
      </div>

      <div className="mt-5 grid gap-4 border-t border-border pt-5 lg:grid-cols-3">
        <ActionSelect
          icon={Link2}
          label="设置可能父版本"
          value={selectedParentId}
          onChange={setParentId}
          options={parentOptions.map((item) => ({ value: item.id, label: item.name }))}
          buttonLabel="设置父版本"
          disabled={!selectedParentId || isApplyingOverride}
          onApply={() => applyOverride('set_parent', [selectedParentId, file.id])}
        />
        <ActionSelect
          icon={GitMerge}
          label="合并到其他家族"
          value={selectedMergeFamilyId}
          onChange={setMergeFamilyId}
          options={otherFamilies.map((item) => ({ value: item.id, label: item.displayName }))}
          buttonLabel="合并家族"
          disabled={!family || !selectedMergeFamilyId || isApplyingOverride}
          onApply={() => applyOverride('merge_families', [family?.id ?? '', selectedMergeFamilyId])}
        />
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm font-medium"><Scissors aria-hidden="true" size={15} />从当前家族拆出</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">建立一个仅包含此文件的新家族，并重算版本关系。</p>
          <Button className="mt-3 w-full" variant="outline" disabled={!family || family.fileIds.length <= 1 || isApplyingOverride} onClick={() => void applyOverride('split_family', [file.id])}>
            拆分文件
          </Button>
        </div>
      </div>

      <p className="mt-4 rounded-lg bg-[#fffbf3] px-3 py-2 text-xs leading-5 text-[#725628]">这些操作只会修正分析报告，不会修改原始文件。可使用报告顶栏的撤销按钮恢复上一步。</p>
    </section>
  );
}

function ActionSelect({ icon: Icon, label, value, onChange, options, buttonLabel, disabled, onApply }: {
  icon: typeof Link2;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  buttonLabel: string;
  disabled: boolean;
  onApply: () => Promise<boolean>;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <label className="flex items-center gap-2 text-sm font-medium"><Icon aria-hidden="true" size={15} />{label}</label>
      <select className="mt-3 h-9 w-full rounded-md border border-border bg-white px-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} disabled={options.length === 0}>
        {options.length === 0 ? <option value="">没有可选项</option> : null}
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      <Button className="mt-3 w-full" variant="outline" disabled={disabled} onClick={() => void onApply()}>{buttonLabel}</Button>
    </div>
  );
}
