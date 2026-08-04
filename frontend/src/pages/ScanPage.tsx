import { useEffect, useRef, useState, type DragEvent } from 'react';
import {
  ArrowLeft,
  CircleAlert,
  FolderOpen,
  LoaderCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { ScanProgress } from '../../../backend/contracts/scan';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project.store';

type ScanPhase = 'idle' | 'scanning' | 'canceling' | 'error';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '扫描未能完成，请重新选择文件夹。';
}

export function ScanPage() {
  const api = window.fileArchaeologist;
  const navigate = useNavigate();
  const beginScan = useProjectStore((state) => state.beginScan);
  const storeResult = useProjectStore((state) => state.setResult);
  const storeError = useProjectStore((state) => state.setError);
  const activeScanId = useRef<string>();
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!api) return;
    return api.onScanProgress((nextProgress) => {
      if (nextProgress.scanId === activeScanId.current) setProgress(nextProgress);
    });
  }, [api]);

  useEffect(
    () => () => {
      if (api && activeScanId.current) void api.cancelScan({ scanId: activeScanId.current });
    },
    [api],
  );

  const fail = (message: string) => {
    setError(message);
    setPhase('error');
    storeError(message);
  };

  const runScan = async (rootPath: string) => {
    if (!api) {
      fail('目录扫描只能在 Final-Final 桌面应用中运行。');
      return;
    }

    const scanId = crypto.randomUUID();
    activeScanId.current = scanId;
    setError(undefined);
    setProgress({ scanId, rootPath, currentDirectory: rootPath, fileCount: 0, warningCount: 0 });
    setPhase('scanning');
    beginScan();

    try {
      const result = await api.scanDirectory({ scanId, rootPath });
      if (activeScanId.current === scanId) {
        await storeResult(result);
        navigate('/report/overview');
      }
    } catch (scanError) {
      if (activeScanId.current === scanId) fail(errorMessage(scanError));
    } finally {
      if (activeScanId.current === scanId) activeScanId.current = undefined;
    }
  };

  const chooseDirectory = async () => {
    if (!api) {
      fail('请通过 Electron 桌面应用选择项目文件夹。浏览器预览不具备文件系统权限。');
      return;
    }
    try {
      const selection = await api.selectDirectory();
      if (!selection.canceled && selection.path) await runScan(selection.path);
    } catch (selectionError) {
      fail(errorMessage(selectionError));
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!api) {
      fail('拖拽扫描只能在 Electron 桌面应用中使用。');
      return;
    }
    const droppedFile = event.dataTransfer.files[0];
    if (!droppedFile || event.dataTransfer.files.length !== 1) {
      fail('请一次拖入一个项目文件夹。');
      return;
    }
    try {
      const selection = await api.authorizeDroppedDirectory(droppedFile);
      if (!selection.canceled && selection.path) await runScan(selection.path);
    } catch (dropError) {
      fail(errorMessage(dropError));
    }
  };

  const cancelScan = async () => {
    if (!api || !activeScanId.current) return;
    setPhase('canceling');
    await api.cancelScan({ scanId: activeScanId.current });
  };

  const isScanning = phase === 'scanning' || phase === 'canceling';

  return (
    <div className="pb-16 pt-8 sm:pt-10">
      <Link className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" to="/">
        <ArrowLeft aria-hidden="true" size={16} />返回首页
      </Link>
      <div className="mt-7">
        <p className="text-sm font-semibold text-primary">只读元数据扫描</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">开始一次本地文件调查</h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
          仅收集文件名、路径、扩展名、大小与时间。扫描不会打开正文，也不会在项目目录中写入任何内容。
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-[0_12px_32px_rgba(24,39,50,0.06)] sm:p-8">
        <div
          className={`grid min-h-[280px] place-items-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors ${isDragging ? 'border-primary bg-primary/[0.05]' : 'border-border bg-[#fafbfb]'}`}
          onDragEnter={(event) => { event.preventDefault(); if (!isScanning) setIsDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => void handleDrop(event)}
        >
          {isScanning && progress ? (
            <ScanProgressView phase={phase} progress={progress} onCancel={cancelScan} />
          ) : (
            <div className="max-w-lg">
              <span className="mx-auto grid size-14 place-items-center rounded-xl bg-[#f3ead7] text-[#705427]"><FolderOpen aria-hidden="true" size={25} /></span>
              <h2 className="mt-5 text-xl font-semibold">选择或拖入项目文件夹</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                默认忽略版本控制、依赖、构建产物、缓存和临时文件；最多扫描 20,000 个文件与 20 层目录。
              </p>
              <Button className="mt-6 h-11 px-5" onClick={() => void chooseDirectory()}>
                <FolderOpen aria-hidden="true" size={18} />选择项目文件夹
              </Button>
              {!api ? <p className="mt-3 text-xs text-[#8a6529]">浏览器预览模式：请启动桌面应用进行扫描。</p> : null}
            </div>
          )}
        </div>
      </section>

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#e8c9c2] bg-[#fff8f6] p-4 text-sm text-[#7a3f34]" role="alert">
          <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={18} /><span>{error}</span>
        </div>
      ) : null}

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={18} />
        <p>扫描器不读取文件内容，不跟随符号链接，也不会修改、移动或删除任何原文件。成功后会自动进入本地调查报告。</p>
      </div>
    </div>
  );
}

function ScanProgressView({ phase, progress, onCancel }: { phase: ScanPhase; progress: ScanProgress; onCancel: () => Promise<void> }) {
  return (
    <div className="w-full max-w-xl">
      <LoaderCircle className="mx-auto animate-spin text-primary" aria-hidden="true" size={30} />
      <h2 className="mt-4 text-lg font-semibold">{phase === 'canceling' ? '正在安全停止扫描…' : '正在读取文件元数据…'}</h2>
      <p className="mt-2 truncate text-sm text-muted-foreground" title={progress.currentDirectory}>{progress.currentDirectory}</p>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="扫描进度" aria-valuetext={`已扫描 ${progress.fileCount} 个文件`}>
        <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
      </div>
      <div className="mt-4 flex items-center justify-center gap-5 text-sm">
        <span>已扫描 {progress.fileCount.toLocaleString()} 个文件</span>
        <span className="text-muted-foreground">{progress.warningCount} 条警告</span>
      </div>
      <Button variant="outline" className="mt-6" disabled={phase === 'canceling'} onClick={() => void onCancel()}>
        <X aria-hidden="true" size={17} />取消扫描
      </Button>
    </div>
  );
}
