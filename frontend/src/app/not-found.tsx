import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="full-page-state shell">
      <span className="state-code">404</span>
      <h1>没有找到这个项目</h1>
      <p>它可能尚未进入 RepoPulse 候选集，或仓库名称已经变更。</p>
      <Link className="primary-button" href="/"><ArrowLeft size={17} />返回榜单</Link>
    </main>
  );
}

