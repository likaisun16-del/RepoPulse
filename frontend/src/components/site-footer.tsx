import { Activity } from "lucide-react";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div className="footer-brand">
          <Activity size={16} />
          <span>RepoPulse</span>
          <span className="footer-note">用可解释的数据，发现正在增长的开源项目。</span>
        </div>
        <div className="footer-links">
          <Link href="/methodology">数据口径</Link>
          <a href="https://github.com/trending" target="_blank" rel="noreferrer">
            GitHub Trending
          </a>
        </div>
      </div>
    </footer>
  );
}

