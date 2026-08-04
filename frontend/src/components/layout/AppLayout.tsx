import { Outlet } from 'react-router-dom';
import brandLogo from '../../../../assets/brand/logo.png';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-white">
        <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center justify-between px-5 sm:px-8">
          <a className="flex items-center gap-3" href="#/" aria-label="文件考古学家首页">
            <img
              src={brandLogo}
              alt=""
              aria-hidden="true"
              className="size-10 rounded-lg border border-border/70 object-cover shadow-sm"
            />
            <span>
              <span className="block text-[15px] font-semibold leading-5">文件考古学家</span>
              <span className="block text-xs leading-4 text-muted-foreground">
                Final-Final
              </span>
            </span>
          </a>

          <nav
            className="hidden items-center gap-7 text-sm text-muted-foreground sm:flex"
            aria-label="主导航"
          >
            <a className="transition-colors hover:text-foreground" href="#product">
              产品介绍
            </a>
            <a className="transition-colors hover:text-foreground" href="#privacy">
              隐私原则
            </a>
            <a
              className="transition-colors hover:text-foreground"
              href="https://github.com/PebbleBird-co/FinalFinal-Chinese"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
