import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  FileDown,
  FolderTree,
  LayoutDashboard,
  LoaderCircle,
  Redo2,
  RefreshCw,
  RotateCw,
  Undo2,
  X,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { activityRange, formatDate, formatDateTime, projectName } from '@/lib/report';
import { useProjectStore } from '@/store/project.store';
import { ReportEmptyState, ReportErrorState, ReportLoadingState } from './ReportStates';

const navigation = [
  { to: '/report/overview', label: '项目总览', icon: LayoutDashboard },
  { to: '/report/timeline', label: '活动时间线', icon: CalendarRange },
  { to: '/report/families', label: '文件家族', icon: FolderTree },
  { to: '/report/risks', label: '风险线索', icon: AlertTriangle },
];

export function ReportLayout() {
  const {
    result,
    status,
    error,
    correctionError,
    dismissCorrectionError,
    history,
    isApplyingOverride,
    persistenceStatus,
    undo,
    redo,
    recalculate,
    exportStatus,
    exportError,
    lastExportPath,
    exportPdf,
    dismissExportStatus,
  } = useProjectStore();

  if (status === 'loading') return <ReportLoadingState />;
  if (status === 'error') return <ReportErrorState message={error} />;
  if (!result) return <ReportEmptyState />;

  const range = activityRange(result);

  return (
    <div className="py-6 sm:py-8">
      <header className="rounded-xl border border-border bg-white px-5 py-5 shadow-[0_8px_24px_rgba(24,39,50,0.04)] sm:px-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <span className="size-1.5 rounded-full bg-[#4f8664]" aria-hidden="true" />
              本地只读调查报告
            </div>
            <h1 className="mt-2 truncate text-2xl font-semibold" title={result.rootPath}>
              {projectName(result.rootPath)}
            </h1>
            <p className="mt-1 break-all text-xs text-muted-foreground">{result.rootPath}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
            <span>
              扫描时间 <strong className="ml-1 font-medium text-foreground">{formatDateTime(result.scannedAt)}</strong>
            </span>
            <span>
              活动范围{' '}
              <strong className="ml-1 font-medium text-foreground">
                {range.start && range.end ? `${formatDate(range.start)} - ${formatDate(range.end)}` : '暂无可靠时间'}
              </strong>
            </span>
            <Button asChild variant="outline" className="h-9">
              <NavLink to="/scan">
                <RefreshCw aria-hidden="true" size={15} />
                重新扫描
              </NavLink>
            </Button>
            <div className="flex items-center gap-1 rounded-md border border-border bg-[#fafbfb] p-1" aria-label="纠正历史">
              <button
                type="button"
                className="grid size-8 place-items-center rounded text-muted-foreground hover:bg-white hover:text-foreground disabled:opacity-35"
                disabled={isApplyingOverride || history.past.length === 0}
                onClick={() => void undo()}
                aria-label="撤销上一次纠正"
                title="撤销上一次纠正"
              >
                <Undo2 aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                className="grid size-8 place-items-center rounded text-muted-foreground hover:bg-white hover:text-foreground disabled:opacity-35"
                disabled={isApplyingOverride || history.future.length === 0}
                onClick={() => void redo()}
                aria-label="重做纠正"
                title="重做纠正"
              >
                <Redo2 aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                className="grid size-8 place-items-center rounded text-muted-foreground hover:bg-white hover:text-foreground disabled:opacity-35"
                disabled={isApplyingOverride}
                onClick={() => void recalculate()}
                aria-label="重新计算报告"
                title="重新计算报告"
              >
                {isApplyingOverride ? <LoaderCircle className="animate-spin" aria-hidden="true" size={16} /> : <RotateCw aria-hidden="true" size={16} />}
              </button>
            </div>
            <Button
              variant="outline"
              className="h-9"
              disabled={isApplyingOverride || exportStatus === 'exporting'}
              onClick={() => void exportPdf()}
            >
              {exportStatus === 'exporting'
                ? <LoaderCircle className="animate-spin" aria-hidden="true" size={15} />
                : <FileDown aria-hidden="true" size={15} />}
              {exportStatus === 'exporting' ? '正在导出…' : '导出 PDF'}
            </Button>
          </div>
        </div>
      </header>

      <div className="mt-3 flex flex-col justify-between gap-2 rounded-lg border border-[#e6d7b8] bg-[#fffbf3] px-4 py-3 text-xs text-[#725628] sm:flex-row sm:items-center">
        <span>用户纠正只会修改本地分析报告，不会修改、移动、重命名或删除原始文件。</span>
        <span className="shrink-0 font-medium">
          {isApplyingOverride
            ? '正在重算并保存…'
            : persistenceStatus === 'saved'
              ? `已保存 · ${history.present.length} 条纠正`
              : persistenceStatus === 'error'
                ? '保存失败'
                : `${history.present.length} 条纠正`}
        </span>
      </div>

      {correctionError ? (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-[#e8c9c2] bg-[#fff8f6] px-4 py-3 text-sm text-[#7a3f34]" role="alert">
          <span>{correctionError}</span>
          <button type="button" className="shrink-0" onClick={dismissCorrectionError} aria-label="关闭纠正错误"><X aria-hidden="true" size={16} /></button>
        </div>
      ) : null}

      {exportStatus === 'success' ? (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-[#cadbcf] bg-[#f4faf6] px-4 py-3 text-sm text-[#376149]" role="status">
          <span className="flex min-w-0 items-start gap-2"><CheckCircle2 className="mt-0.5 shrink-0" aria-hidden="true" size={16} /><span>PDF 报告已导出<span className="mt-1 block break-all text-xs opacity-80">{lastExportPath}</span></span></span>
          <button type="button" className="shrink-0" onClick={dismissExportStatus} aria-label="关闭导出提示"><X aria-hidden="true" size={16} /></button>
        </div>
      ) : null}

      {exportStatus === 'error' ? (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-[#e8c9c2] bg-[#fff8f6] px-4 py-3 text-sm text-[#7a3f34]" role="alert">
          <span>{exportError ?? 'PDF 报告未能导出。'}</span>
          <button type="button" className="shrink-0" onClick={dismissExportStatus} aria-label="关闭导出错误"><X aria-hidden="true" size={16} /></button>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <nav className="flex gap-2 overflow-x-auto rounded-xl border border-border bg-white p-2 lg:flex-col" aria-label="报告导航">
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <Icon aria-hidden="true" size={17} />
                {label}
              </NavLink>
            ))}
          </nav>
          <p className="mt-3 hidden px-3 text-xs leading-5 text-muted-foreground lg:block">
            所有关系、事件与风险均为基于元数据的推测，请展开证据后人工确认。
          </p>
        </aside>
        <div className="min-w-0">
          <Outlet context={result} />
        </div>
      </div>
    </div>
  );
}
