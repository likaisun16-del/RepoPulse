import { Activity } from "lucide-react";

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
          <span>UTC 快照 · 净增长口径</span>
          <a href="https://github.com/trending" target="_blank" rel="noreferrer">
            GitHub Trending
          </a>
        </div>
      </div>
    </footer>
  );
}
