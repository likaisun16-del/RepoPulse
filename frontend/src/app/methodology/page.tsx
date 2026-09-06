import type { Metadata } from "next";
import { CalendarRange, Database, GitCompareArrows, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "数据口径",
  description: "了解 RepoPulse 的候选集、快照、排名计算和数据边界。",
  alternates: { canonical: "/methodology" },
};

const STEPS = [
  {
    number: "01",
    icon: <Database size={21} />,
    title: "发现候选项目",
    copy: "从 GitHub Trending、GitHub Search 和人工种子集合发现项目；默认排除 fork、归档和停用仓库。",
  },
  {
    number: "02",
    icon: <CalendarRange size={21} />,
    title: "保存每日快照",
    copy: "每天在统一的 UTC 时间记录仓库 Star、Fork 等聚合数据，不收集任何 Star 用户身份。",
  },
  {
    number: "03",
    icon: <GitCompareArrows size={21} />,
    title: "计算周期增量",
    copy: "用截止快照减去 1、7、14 或 30 天前的有效基线快照，得到可解释的 Star 净增长；没有基线的项目暂显示无增长。",
  },
  {
    number: "04",
    icon: <ShieldCheck size={21} />,
    title: "生成稳定排名",
    copy: "先按净增长排序，再依次比较增长率、当前 Star 和仓库名称，确保相同数据始终得到相同排名。",
  },
];

export default function MethodologyPage() {
  return (
    <main className="method-page">
      <section className="method-intro">
        <div className="shell narrow-shell">
          <span className="eyebrow-text">METHODOLOGY</span>
          <h1>数据口径透明，<br />每一个排名都有依据。</h1>
          <p>RepoPulse 关注的是一段时间内真实发生的净增长，而不是复刻 GitHub 未公开的 Trending 算法。</p>
        </div>
      </section>
      <section className="method-steps">
        <div className="shell narrow-shell">
          {STEPS.map((step) => (
            <article key={step.number}>
              <span className="step-number">{step.number}</span>
              <span className="step-icon">{step.icon}</span>
              <div><h2>{step.title}</h2><p>{step.copy}</p></div>
            </article>
          ))}
        </div>
      </section>
      <section className="formula-section">
        <div className="shell narrow-shell formula-grid">
          <div><span>核心公式</span><h2>简单，但不含糊</h2><p>所有计算以 UTC 为准，界面以北京时间展示。</p></div>
          <code>net_delta = end_stars - start_stars</code>
          <code>growth_rate = net_delta / start_stars</code>
        </div>
      </section>
      <section className="boundary-section">
        <div className="shell narrow-shell">
          <h2>数据边界</h2>
          <p>榜单只代表 RepoPulse 当前跟踪候选集，不是全 GitHub 仓库的绝对排名。没有历史基线的项目会保留在结果中并显示无增长，待快照积累后自动切换为真实增量。基线距离周期边界超过 36 小时的项目暂不计入真实增长。</p>
        </div>
      </section>
    </main>
  );
}
