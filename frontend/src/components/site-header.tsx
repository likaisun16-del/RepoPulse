"use client";

import { Activity, Github, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";

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
            <TrendingUp size={15} />
            增长榜
          </Link>
        </nav>
        <div className="header-actions">
          <ThemeToggle />
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
      </div>
    </header>
  );
}
