import type { Repository } from "@/lib/types";

type RepositoryDescriptionSource = Pick<Repository, "owner" | "name" | "description">;

const LOCALIZED_DESCRIPTIONS: Record<string, string> = {
  "ollama/ollama": "在本地快速运行和管理开源大语言模型。",
  "astral-sh/uv": "使用 Rust 构建的极速 Python 包与项目管理工具。",
  "langchain-ai/langgraph": "为可靠的智能体工作流构建有状态、多角色应用。",
  "supabase/supabase": "开源的 Firebase 替代方案，提供数据库、认证与存储能力。",
  "fastapi/fastapi": "现代、高性能且易于学习的 Python Web API 框架。",
  "vercel/next.js": "用于构建全栈 Web 应用的 React 框架。",
  "openai/openai-python": "用于从 Python 应用访问 OpenAI API 的官方 SDK。",
  "rustdesk/rustdesk": "开源远程桌面应用，可替代商业远程控制工具。",
  "tauri-apps/tauri": "使用 Web 前端构建小巧、快速、安全的桌面应用。",
  "denoland/deno": "JavaScript、TypeScript 和 WebAssembly 运行时。",
  "pytorch/pytorch": "面向研究与生产的开源机器学习框架。",
  "gohugoio/hugo": "使用 Go 构建的快速、灵活静态网站生成器。",
  "deepseek-ai/deepseek-harness": "DeepSeek Harness：一切皆为插件。",
};

const LOCALIZED_DESCRIPTIONS_BY_NAME: Record<string, string> = {
  "deepseek-harness": "DeepSeek Harness：一切皆为插件。",
};

export function getRepositoryDescription(
  repository: RepositoryDescriptionSource,
): string | null {
  if (!repository.description) return null;

  const fullName = `${repository.owner}/${repository.name}`.toLowerCase();
  return (
    LOCALIZED_DESCRIPTIONS[fullName] ??
    LOCALIZED_DESCRIPTIONS_BY_NAME[repository.name.toLowerCase()] ??
    repository.description
  );
}
