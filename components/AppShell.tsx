"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bot,
  Boxes,
  Database,
  MapPinned,
  Menu,
  Network,
  X
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primaryNav = [
  { href: "/supplymap", label: "공급망 분석", icon: Network },
  { href: "/data-catalog", label: "공공데이터 카탈로그", icon: Database }
];

const legacyNav = [
  { href: "/heatmap", label: "해외공장 히트맵", icon: MapPinned },
  { href: "/map", label: "공장 지도", icon: MapPinned },
  { href: "/factories", label: "공장 DB", icon: Boxes },
  { href: "/chatbot", label: "무역 어시스턴트", icon: Bot },
  { href: "/features", label: "운영 도구", icon: Boxes }
];

function Navigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="주 메뉴">
      <p className="px-3 text-[11px] font-semibold uppercase text-muted">Workspace</p>
      <div className="mt-2 space-y-1">
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active ? "bg-cobalt font-semibold text-white" : "text-ink hover:bg-panel"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-muted"}`} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="my-5 border-t border-line" />
      <p className="px-3 text-[11px] font-semibold uppercase text-muted">Operations</p>
      <div className="mt-2 space-y-1">
        {legacyNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active ? "bg-panel font-semibold text-cobalt" : "text-muted hover:bg-panel hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isHome = pathname === "/";

  if (isHome) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-panel">
      <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="border-b border-line px-5 py-5">
          <Link href="/" className="flex items-center gap-3" aria-label="PortMind SupplyMap AI 홈">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-line bg-white">
              <Image src="/portmind-mark.png" alt="" width={40} height={40} className="h-10 w-10 object-cover" />
            </span>
            <span>
              <span className="block text-base font-bold text-ink">PortMind</span>
              <span className="mt-0.5 block text-[11px] text-muted">KR/CN factory intelligence</span>
            </span>
          </Link>
        </div>
        <Navigation pathname={pathname} />
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3 rounded-md bg-panel p-3">
            <Image src="/portmind-mark.png" alt="PortMind" width={32} height={32} className="h-8 w-8 rounded-sm object-cover" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink">SupplyMap AI</p>
              <p className="mt-0.5 text-[11px] text-muted">PortMind platform</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-ink">
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-line bg-white">
                <Image src="/portmind-mark.png" alt="" width={32} height={32} className="h-8 w-8 object-cover" />
              </span>
              PortMind
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-ink"
              aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
              title={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {mobileOpen ? (
          <div className="fixed inset-0 z-20 bg-ink/30 md:hidden" onClick={() => setMobileOpen(false)}>
            <aside
              className="absolute bottom-0 left-0 top-[57px] flex w-[286px] flex-col border-r border-line bg-white"
              onClick={(event) => event.stopPropagation()}
            >
              <Navigation pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
