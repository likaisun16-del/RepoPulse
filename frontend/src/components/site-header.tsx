"use client";

import { Activity, BookOpen, Github } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const rankingActive = pathname === "/" || pathname.startsWith("/ranking");

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="RepoPulse 首页">
          <span className="brand-mark" aria-hidden="true">
            <Activity size={19} strokeWidth={2.4} />
          </span>
          <span>RepoPulse</span>
        </Link>
        <nav className="main-nav" aria-label="主导航">
          <Link className={rankingActive ? "active" : ""} href="/ranking?period=7">
            增长榜
          </Link>
          <Link className={pathname === "/methodology" ? "active" : ""} href="/methodology">
            <BookOpen size={15} />
            数据口径
          </Link>
        </nav>
        <a
          className="icon-link"
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          aria-label="访问 GitHub"
          title="访问 GitHub"
        >
          <Github size={19} />
        </a>
      </div>
    </header>
  );
}

