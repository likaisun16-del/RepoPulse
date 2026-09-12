"use client";

import Link from "next/link";
import { Languages, LoaderCircle, Settings, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { findProvider } from "@/lib/ai/catalog";
import { requestReadme } from "@/lib/ai/client";
import { MAX_README_CHARS, type AiResult } from "@/lib/ai/contracts";
import { activeCredentials } from "@/lib/ai/storage";
import { MarkdownContent } from "@/components/markdown-content";

const subscribeLocation = () => () => undefined;
const settingsLocation = () => `/settings/ai?returnTo=${encodeURIComponent(window.location.pathname + window.location.search + "#readme-heading")}`;
const serverSettingsLocation = () => "/settings/ai";

export function ReadmeAi({ markdown, imageBaseUrl }: { markdown: string; imageBaseUrl: string }) {
  const [result, setResult] = useState<AiResult | null>(null);
  const [translated, setTranslated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [modelLabel, setModelLabel] = useState("");
  const settingsHref = useSyncExternalStore(subscribeLocation, settingsLocation, serverSettingsLocation);
  const [progress, setProgress] = useState({ completed: 0, total: 1, message: "准备生成" });
  const pending = useRef<AbortController | null>(null);
  const pendingModel = useRef("");
  const cache = useRef(new Map<string, AiResult>());

  const refresh = useCallback(() => {
    try {
      const credentials = activeCredentials();
      const selection = credentials ? JSON.stringify([credentials.provider, credentials.model]) : "";
      if (pending.current && selection !== pendingModel.current) {
        pending.current.abort(); pending.current = null; setBusy(false);
        setError("模型配置已改变，已取消之前的生成。");
      }
      const cached = credentials ? cache.current.get(JSON.stringify([markdown, credentials.provider, credentials.model])) : null;
      setResult(cached ?? null); setTranslated(Boolean(cached));
      if (credentials) setModelLabel(findProvider(credentials.provider)?.models.find((item) => item.id === credentials.model)?.name ?? credentials.model);
    } catch { setResult(null); setTranslated(false); }
  }, [markdown]);

  useEffect(() => {
    window.addEventListener("focus", refresh); window.addEventListener("storage", refresh);
    window.addEventListener("repopulse-ai-change", refresh);
    return () => {
      pending.current?.abort(); pending.current = null;
      window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh);
      window.removeEventListener("repopulse-ai-change", refresh);
    };
  }, [refresh]);

  async function generate() {
    if (pending.current) return;
    setError(""); setMissing(false);
    if (markdown.length > MAX_README_CHARS) { setError("README 超过 100,000 字符，暂不支持翻译。"); return; }
    let credentials;
    try { credentials = activeCredentials(); }
    catch (cause) { setError((cause as Error).message); setMissing(true); return; }
    if (!credentials) { setMissing(true); return; }
    const controller = new AbortController(); pending.current = controller;
    pendingModel.current = JSON.stringify([credentials.provider, credentials.model]);
    setBusy(true); setProgress({ completed: 0, total: 1, message: "正在连接模型" });
    const provider = findProvider(credentials.provider);
    setModelLabel(provider?.models.find((item) => item.id === credentials.model)?.name ?? credentials.model);
    try {
      const generated = await requestReadme(credentials, markdown, AbortSignal.any([controller.signal, AbortSignal.timeout(600_000)]), (event) => { if (pending.current === controller) setProgress(event); });
      if (pending.current !== controller) return;
      cache.current.set(JSON.stringify([markdown, credentials.provider, credentials.model]), generated);
      setResult(generated); setTranslated(true);
    } catch (cause) {
      if (pending.current === controller) setError(controller.signal.aborted ? "已取消生成。" : cause instanceof Error && cause.name === "TimeoutError" ? "生成超时，请稍后重试。" : cause instanceof Error && cause.name !== "TypeError" ? cause.message : "网络连接失败，请稍后重试。");
    } finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  }

  return <>
    <div className="readme-ai-toolbar">
      <div className="ai-readme-tabs" aria-label="文档语言"><button className={!translated ? "selected" : ""} aria-pressed={!translated} onClick={() => setTranslated(false)}>原文</button><button disabled={!result} className={translated ? "selected" : ""} aria-pressed={translated} onClick={() => setTranslated(true)}><Languages size={15} />中文译文</button></div>
      <button className="ai-button ai-primary" disabled={busy || !markdown.trim()} onClick={generate}>{busy ? <LoaderCircle className="ai-spin" size={16} /> : <Sparkles size={16} />}{busy ? "生成中" : result ? "重新生成" : "总结翻译"}</button>
      <Link className="ai-icon-button" href={settingsHref} aria-label="模型设置" title="模型设置"><Settings size={17} /></Link>
    </div>
    {missing ? <p className="ai-readme-notice" role="status">请先配置模型，再发起总结翻译。<Link href={settingsHref}>前往设置</Link></p> : null}
    {busy ? <div className="ai-readme-progress" role="status"><span>{progress.message}</span><progress aria-label="翻译进度" value={progress.completed} max={progress.total} /><button className="ai-button" onClick={() => pending.current?.abort()}><X size={15} />取消</button></div> : null}
    {error ? <p className="ai-error ai-readme-notice" role="alert">{error}</p> : null}
    <article className="readme-content">
      {result && translated ? <section className="ai-summary" aria-label="AI 摘要"><div className="ai-summary-title"><strong><Sparkles size={17} />AI 摘要</strong><small>{modelLabel} · AI 生成，请结合原文核对</small></div><MarkdownContent content={result.summary} imageBaseUrl={imageBaseUrl} /></section> : null}
      <MarkdownContent content={translated && result ? result.translation : markdown} imageBaseUrl={imageBaseUrl} />
    </article>
  </>;
}
