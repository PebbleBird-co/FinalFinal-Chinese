import { CircleAlert, FileSearch2, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function ReportEmptyState() {
  return (
    <section className="mx-auto my-16 max-w-2xl rounded-2xl border border-border bg-white px-6 py-14 text-center shadow-[0_10px_30px_rgba(24,39,50,0.05)]">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#f3ead7] text-[#705427]">
        <FileSearch2 aria-hidden="true" size={22} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold">还没有可查看的项目报告</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
        报告只保留在当前应用进程中。请选择一个项目文件夹并完成本地只读扫描。
      </p>
      <Button asChild className="mt-6">
        <Link to="/scan">开始本地调查</Link>
      </Button>
    </section>
  );
}

export function ReportLoadingState() {
  return (
    <section className="grid min-h-[420px] place-items-center text-center" aria-live="polite">
      <div>
        <LoaderCircle className="mx-auto animate-spin text-primary" aria-hidden="true" size={30} />
        <h1 className="mt-4 text-xl font-semibold">正在整理调查结果</h1>
        <p className="mt-2 text-sm text-muted-foreground">分析仅基于文件元数据，并在本机完成。</p>
      </div>
    </section>
  );
}

export function ReportErrorState({ message }: { message?: string }) {
  return (
    <section className="mx-auto my-16 max-w-2xl rounded-2xl border border-[#e8c9c2] bg-[#fff8f6] px-6 py-12 text-center text-[#7a3f34]" role="alert">
      <CircleAlert className="mx-auto" aria-hidden="true" size={28} />
      <h1 className="mt-4 text-xl font-semibold">调查报告未能生成</h1>
      <p className="mt-2 text-sm leading-6">{message ?? '请重新选择项目文件夹后再试。'}</p>
      <Button asChild variant="outline" className="mt-6 border-[#d9b9b2] bg-white text-foreground">
        <Link to="/scan">返回扫描页</Link>
      </Button>
    </section>
  );
}
