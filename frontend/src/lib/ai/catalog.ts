export const AI_PROVIDERS = [
  { id: "deepseek", name: "DeepSeek", logo: "deepseek", models: [
    { id: "deepseek-flash", name: "DeepSeek Flash" },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
  ] },
  { id: "openai", name: "OpenAI", logo: "openai", models: [
    { id: "gpt-4.1-mini", name: "GPT-4.1 mini" },
    { id: "gpt-4.1", name: "GPT-4.1" },
  ] },
  { id: "gemini", name: "Gemini", logo: "gemini", models: [
    { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite" },
    { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
  ] },
  { id: "claude", name: "Claude", logo: "claude", models: [
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
    { id: "claude-sonnet-5", name: "Claude Sonnet 5" },
  ] },
  { id: "qwen", name: "通义千问", logo: "qwen", models: [
    { id: "qwen-plus", name: "Qwen Plus（中国内地）" },
    { id: "qwen-max", name: "Qwen Max（中国内地）" },
  ] },
] as const;

export type ProviderId = typeof AI_PROVIDERS[number]["id"];
export function findProvider(id: string) {
  return AI_PROVIDERS.find((provider) => provider.id === id);
}
export function isModelAvailable(provider: string, model: string): boolean {
  return Boolean(findProvider(provider)?.models.some((item) => item.id === model));
}
