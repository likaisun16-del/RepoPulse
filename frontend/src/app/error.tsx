"use client";

import { RotateCcw } from "lucide-react";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="full-page-state shell">
      <span className="state-code">500</span>
      <h1>页面暂时没有响应</h1>
      <p>数据可能正在更新，请稍后重试。</p>
      <button className="primary-button" type="button" onClick={reset}><RotateCcw size={17} />重新加载</button>
    </main>
  );
}

