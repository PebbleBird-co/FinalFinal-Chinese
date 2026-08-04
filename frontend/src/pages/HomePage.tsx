import {
  Check,
  Clock3,
  FileCheck2,
  FileText,
  FolderOpen,
  GitBranch,
  HardDrive,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const trustPills = ['只读分析', '不读取正文', '不上传云端', '不修改原文件'];

const trustItems = [
  {
    icon: LockKeyhole,
    title: '不读取正文',
    description: '只检查文件名、路径、扩展名、大小和时间信息，文档内容始终保持私密。',
    tone: 'bg-[#f3ead7] text-[#705427]',
  },
  {
    icon: HardDrive,
    title: '完全本地分析',
    description: '扫描与推断只在这台电脑上完成，不上传文件，也不依赖云端服务。',
    tone: 'bg-[#e5eef1] text-primary',
  },
  {
    icon: ShieldCheck,
    title: '不修改原文件',
    description: '不会移动、重命名、覆盖或删除文件；所有结论都只是辅助人工确认的推测。',
    tone: 'bg-[#e7efe9] text-[#315d45]',
  },
];

export function HomePage() {
  return (
    <div className="pb-14 sm:pb-20">
      <section
        id="product"
        className="grid items-center gap-12 py-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(440px,0.98fr)] lg:gap-14 lg:py-16"
      >
        <div className="max-w-[560px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-sm font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            本地只读调查工具
          </div>

          <h1 className="mt-6 text-[40px] font-bold leading-[1.12] sm:text-[52px] lg:text-[60px] lg:leading-[1.08]">
            从混乱文件夹里，
            <span className="block text-primary">还原一个项目的版本历史。</span>
          </h1>

          <p className="mt-6 max-w-[540px] text-lg leading-8 text-muted-foreground sm:text-xl">
            依据文件名、目录关系、大小与时间线索，在本地推测文件家族、版本分支与正式版本候选，帮助你更有依据地完成最终确认。
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-12 px-5 text-[15px] shadow-sm">
              <Link to="/scan">
                <FolderOpen aria-hidden="true" size={18} />
                选择项目文件夹
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 px-5 text-[15px]">
              <a href="#example-report">
                <FileText aria-hidden="true" size={18} />
                查看示例报告
              </a>
            </Button>
          </div>

          <div className="mt-6 flex max-w-[550px] flex-wrap gap-2" aria-label="产品隐私特性">
            {trustPills.map((pill) => (
              <span
                key={pill}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                <Check aria-hidden="true" size={13} className="text-primary" />
                {pill}
              </span>
            ))}
          </div>
        </div>

        <AnalysisPreview />
      </section>

      <section
        id="start"
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-primary/15 bg-primary text-primary-foreground shadow-[0_14px_36px_rgba(26,54,66,0.10)]"
      >
        <div className="grid gap-7 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10 lg:py-8">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#f2e6cc] text-[#6f5324]">
              <FolderOpen aria-hidden="true" size={22} />
            </span>
            <div>
              <h2 className="text-xl font-semibold">准备开始一次本地调查</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-primary-foreground/75 sm:text-base">
                选择一个项目文件夹，系统将只读取文件名、路径、扩展名、大小与时间信息，不读取正文，也不会修改原文件。
              </p>
              <p className="mt-2 text-xs text-primary-foreground/60">
                扫描全程在本机进行；超限或遇到无权限文件时会明确记录并继续安全处理。
              </p>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            className="h-12 border-white/25 bg-white px-5 text-primary hover:bg-white/90"
          >
            <Link to="/scan">
              <FolderOpen aria-hidden="true" size={18} />
              选择项目文件夹
            </Link>
          </Button>
        </div>
      </section>

      <section id="privacy" className="scroll-mt-24 pt-14 sm:pt-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary">隐私与只读原则</p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
            调查留下结论，不触碰你的原始文件
          </h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            每一项设计都围绕本地、克制和可核验展开。系统提供证据与置信度，最终判断始终由你完成。
          </p>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {trustItems.map(({ icon: Icon, title, description, tone }) => (
            <article
              key={title}
              className="rounded-2xl border border-border/90 bg-white p-6 shadow-[0_8px_24px_rgba(24,39,50,0.045)]"
            >
              <span className={`grid size-11 place-items-center rounded-xl ${tone}`}>
                <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
              </span>
              <h3 className="mt-5 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AnalysisPreview() {
  return (
    <aside
      id="example-report"
      className="scroll-mt-24 rounded-2xl border border-border bg-white shadow-[0_18px_45px_rgba(24,39,50,0.09)]"
      aria-label="分析结果示例"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
        <div>
          <p className="text-sm font-semibold">项目分析预览</p>
          <p className="mt-0.5 text-xs text-muted-foreground">产品策划案 · 12 个文件</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf4ef] px-2.5 py-1 text-xs font-medium text-[#39654b]">
          <span className="size-1.5 rounded-full bg-[#4f8664]" aria-hidden="true" />
          本地分析
        </span>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">文件家族</p>
            <p className="mt-1 text-sm font-semibold">产品策划案</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f6ead1] px-2.5 py-1 text-xs font-medium text-[#765722]">
            <GitBranch aria-hidden="true" size={13} />
            检测到 3 条版本分支
          </span>
        </div>

        <div
          className="relative mt-5 h-[178px] overflow-hidden rounded-xl bg-[#f8fafb]"
          aria-label="简化文件家族树"
        >
          <div
            className="absolute left-1/2 top-[46px] h-[38px] w-px bg-[#b8c6cc]"
            aria-hidden="true"
          />
          <div
            className="absolute left-[25%] right-[25%] top-[83px] h-px bg-[#b8c6cc]"
            aria-hidden="true"
          />
          <div
            className="absolute left-[25%] top-[83px] h-[24px] w-px bg-[#b8c6cc]"
            aria-hidden="true"
          />
          <div
            className="absolute right-[25%] top-[83px] h-[24px] w-px bg-[#b8c6cc]"
            aria-hidden="true"
          />
          <div
            className="absolute right-[25%] top-[137px] h-[17px] w-px bg-primary/40"
            aria-hidden="true"
          />

          <FileNode className="left-1/2 top-3 -translate-x-1/2" label="产品策划案.docx" />
          <FileNode className="left-[25%] top-[106px] -translate-x-1/2" label="修改版" muted />
          <FileNode className="right-[25%] top-[106px] translate-x-1/2" label="最终版" />
          <FileNode className="right-[25%] top-[151px] translate-x-1/2" label="提交版" active />
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 aria-hidden="true" size={14} />
              活动时间线
            </span>
            <span>5 月 12 日 - 6 月 03 日</span>
          </div>
          <div
            className="relative mt-3 flex h-8 items-end justify-between gap-1"
            aria-label="项目活动时间线示例"
          >
            <div className="absolute bottom-1 left-0 right-0 h-px bg-border" aria-hidden="true" />
            {[8, 12, 9, 18, 13, 24, 17, 30, 20, 14, 26, 16].map((height, index) => (
              <span
                key={`${height}-${index}`}
                className={`relative z-10 w-2 rounded-sm ${index === 7 ? 'bg-[#c8963d]' : 'bg-primary/55'}`}
                style={{ height }}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-border bg-[#fbfaf7] px-5 py-4 sm:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <FileCheck2 aria-hidden="true" size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">当前最可信正式版本</p>
          <p className="truncate text-sm font-semibold">产品策划案_提交版.docx</p>
        </div>
        <span className="text-xs font-semibold text-primary">较可能 · 82%</span>
      </div>
    </aside>
  );
}

function FileNode({
  className,
  label,
  active = false,
  muted = false,
}: {
  className: string;
  label: string;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={`absolute inline-flex h-8 max-w-[148px] items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium shadow-sm ${className} ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : muted
            ? 'border-border bg-white text-muted-foreground'
            : 'border-primary/25 bg-white text-foreground'
      }`}
    >
      <FileText aria-hidden="true" size={12} className="shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
