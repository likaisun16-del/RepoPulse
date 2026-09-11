import { z } from "zod";
import { credentialsSchema, type AiCredentials } from "./contracts";

export const AI_STORAGE_KEY = "repopulse-ai-v1";
const settingsSchema = z.object({ selected: z.string().nullable(), providers: z.record(z.string(), credentialsSchema) });
export type AiSettings = z.infer<typeof settingsSchema>;
export const emptySettings = (): AiSettings => ({ selected: null, providers: {} });

export function loadAiSettings(): AiSettings {
  let raw: string | null;
  try { raw = localStorage.getItem(AI_STORAGE_KEY); }
  catch { throw new Error("浏览器禁止读取本地配置，请检查隐私设置。"); }
  if (!raw) return emptySettings();
  try { return settingsSchema.parse(JSON.parse(raw)); }
  catch { throw new Error("本地模型配置已失效，请重新保存或清除配置。"); }
}

export function storeAiSettings(settings: AiSettings): void {
  try {
    if (!Object.keys(settings.providers).length) localStorage.removeItem(AI_STORAGE_KEY);
    else localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("repopulse-ai-change"));
  } catch { throw new Error("无法保存配置，请检查浏览器存储权限或空间。"); }
}

export function activeCredentials(): AiCredentials | null {
  const settings = loadAiSettings();
  return settings.selected ? settings.providers[settings.selected] ?? null : null;
}

export function safeAiReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/repo/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return null;
  return value;
}
