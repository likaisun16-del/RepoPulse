import { expect, test } from "@playwright/test";
import { AI_PROVIDERS } from "../src/lib/ai/catalog";
import { credentialsSchema, readmeRequestSchema } from "../src/lib/ai/contracts";
import { callModel, parseCompletion, providerRequest } from "../src/lib/ai/server/provider";
import { publicAiError, upstreamError } from "../src/lib/ai/server/errors";
import { splitMarkdown, translateReadme, validateTranslation } from "../src/lib/ai/server/translate";
import { generateReadme, testConnection } from "../src/lib/ai/server/http";

const credentials = { provider: "deepseek", model: "deepseek-flash", apiKey: "sk-test-secret" };
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
function completion(content: string) { return Response.json({ choices: [{ finish_reason: "stop", message: { content } }] }); }
function request(body: unknown, signal?: AbortSignal) { return new Request("http://localhost/api/ai/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }); }

test("credentials whitelist rejects custom endpoints, models and oversized documents", () => {
  expect(credentialsSchema.safeParse(credentials).success).toBe(true);
  for (const invalid of [{ ...credentials, endpoint: "http://localhost" }, { ...credentials, model: "unknown" }, { ...credentials, apiKey: "bad\nkey" }]) expect(credentialsSchema.safeParse(invalid).success).toBe(false);
  expect(readmeRequestSchema.safeParse({ ...credentials, markdown: "a".repeat(100001) }).success).toBe(false);
});

for (const provider of AI_PROVIDERS) {
  test(`${provider.id} uses fixed endpoint and sends credentials only in headers`, async () => {
    let called = false;
    const selected = { ...credentials, provider: provider.id, model: provider.models[0].id };
    globalThis.fetch = async (url, options) => {
      called = true;
      expect(String(url)).toMatch(/^https:\/\//);
      expect(String(url)).not.toContain(credentials.apiKey);
      expect(String(options?.body)).not.toContain(credentials.apiKey);
      expect(JSON.stringify(options?.headers)).toContain(credentials.apiKey);
      expect(options?.redirect).toBe("error");
      expect(options?.cache).toBe("no-store");
      const body = JSON.parse(String(options?.body));
      if (provider.id === "claude") {
        expect(body.system).toBe("system");
        return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: "OK" }] });
      }
      if (provider.id === "gemini") {
        expect(body.systemInstruction.parts[0].text).toBe("system");
        return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "private reasoning", thought: true }, { text: "OK" }] } }] });
      }
      expect(body.messages[0].content).toBe("system");
      return completion("OK");
    };
    expect(await callModel(selected, "system", "input", new AbortController().signal, 128)).toBe("OK");
    expect(called).toBe(true);
  });
}

test("vendor errors and malformed output never echo credentials", async () => {
  for (const [status, code] of [[401, "INVALID_KEY"], [403, "FORBIDDEN"], [402, "QUOTA"], [429, "RATE_LIMIT"], [500, "UNAVAILABLE"]] as const) {
    globalThis.fetch = async () => Response.json({ error: { message: credentials.apiKey } }, { status });
    const response = await testConnection(request(credentials));
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text(); expect(text).toContain(code); expect(text).not.toContain(credentials.apiKey);
  }
  expect(upstreamError(429, { error: { code: "insufficient_quota" } }).code).toBe("QUOTA");
  expect(() => parseCompletion("openai", { choices: [{ finish_reason: "length", message: { content: "partial" } }] })).toThrow();
  expect(() => parseCompletion("claude", { stop_reason: "max_tokens", content: [{ type: "text", text: "partial" }] })).toThrow();
  expect(() => parseCompletion("gemini", { candidates: [{ finishReason: "SAFETY" }] })).toThrow();
  expect(() => parseCompletion("openai", { choices: [{ finish_reason: "stop", message: { content: "" } }] })).toThrow();
});

test("request validation rejects cross-origin and malformed bodies without vendor calls", async () => {
  globalThis.fetch = async () => { throw new Error("must not call vendor"); };
  expect((await testConnection(request({ ...credentials, endpoint: "https://evil.test" }))).status).toBe(400);
  const cross = request(credentials); cross.headers.set("origin", "https://evil.test");
  expect((await testConnection(cross)).status).toBe(403);
  expect((await generateReadme(request({ ...credentials, markdown: "a".repeat(100001) }))).status).toBe(400);
});

test("Markdown grouping preserves exact code, links and source order", () => {
  const source = "# Hello\n\n" + "A paragraph.\n\n".repeat(600) + "```js\nconst x = 1;\n```\n\n[Docs](https://example.com)\n";
  const chunks = splitMarkdown(source);
  expect(chunks.map((chunk) => chunk.source).join("")).toBe(source);
  expect(chunks.length).toBeGreaterThan(2);
  expect(chunks.some((chunk) => chunk.literal && chunk.source.includes("const x"))).toBe(true);
  expect(() => validateTranslation("[Docs](https://a.test)", "[文档](https://evil.test)")).toThrow();
  expect(() => validateTranslation("`npm install`", "`npm remove`")).toThrow();
  expect(() => validateTranslation("[Docs](https://a.test)", "[文档](https://a.test)")).not.toThrow();
});

test("translation streams milestones, preserves literal code and returns real parsed summary", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    expect(body.messages[0].content).toContain("untrusted document data");
    const input = JSON.parse(body.messages[1].content);
    calls.push(input.document ?? "summary");
    return completion(JSON.stringify(input.document ? { translation: input.document.replace("Hello", "你好").trim(), summary: "项目介绍" } : { summary: "这是项目摘要。" }));
  };
  const response = await generateReadme(request({ ...credentials, markdown: "# Hello\n\n```js\nconst x = 1;\n```\n" }));
  const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
  expect(events[0].type).toBe("progress");
  const result = events.at(-1).result;
  expect(result.summary).toBe("这是项目摘要。");
  expect(result.translation).toContain("# 你好");
  expect(result.translation).toContain("```js\nconst x = 1;\n```");
  expect(calls).toHaveLength(2);
});

test("invalid JSON and truncated connections produce errors instead of fabricated translations", async () => {
  globalThis.fetch = async () => completion("not JSON");
  const response = await generateReadme(request({ ...credentials, markdown: "# Hello" }));
  const body = await response.text();
  expect(body).toContain('"type":"error"'); expect(body).not.toContain('"type":"result"');
});

test("cancellation aborts upstream and timeout errors are explicit", async () => {
  const cancellation = new AbortController();
  globalThis.fetch = async (_url, options) => new Promise<Response>((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => reject(options.signal?.reason));
    cancellation.abort();
  });
  await expect(translateReadme(credentials, "Hello", cancellation.signal, () => undefined)).rejects.toMatchObject({ code: "CANCELLED" });
  expect(publicAiError(new DOMException("deadline", "TimeoutError")).code).toBe("TIMEOUT");
  expect(() => providerRequest({ ...credentials, provider: "invalid" }, "", "", 1)).toThrow();
});

test("upstream deadline is 90 seconds and task deadline is ten minutes", async () => {
  const timeout = AbortSignal.timeout;
  const deadlines: number[] = [];
  AbortSignal.timeout = (milliseconds: number) => {
    deadlines.push(milliseconds);
    const controller = new AbortController();
    if (milliseconds === 90_000) queueMicrotask(() => controller.abort(new DOMException("deadline", "TimeoutError")));
    return controller.signal;
  };
  globalThis.fetch = async (_url, options) => new Promise<Response>((_resolve, reject) => {
    if (options?.signal?.aborted) reject(options.signal.reason);
    else options?.signal?.addEventListener("abort", () => reject(options.signal?.reason));
  });
  try {
    const response = await generateReadme(request({ ...credentials, markdown: "Hello" }));
    expect(await response.text()).toContain('"code":"TIMEOUT"');
    expect(deadlines).toEqual([600_000, 90_000]);
  } finally { AbortSignal.timeout = timeout; }
});

test("closing the response stream propagates cancellation to the vendor", async () => {
  let aborted = false;
  globalThis.fetch = async (_url, options) => new Promise<Response>((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => { aborted = true; reject(options.signal?.reason); });
  });
  const response = await generateReadme(request({ ...credentials, markdown: "Hello" }));
  const reader = response.body?.getReader();
  expect(reader).toBeTruthy();
  await reader?.read();
  await reader?.cancel();
  expect(aborted).toBe(true);
});

test("reference definitions are preserved across chunk boundaries", async () => {
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    const input = JSON.parse(body.messages[1].content);
    return completion(JSON.stringify(input.document ? { translation: input.document.replace("Title", "标题").trim(), summary: "链接说明" } : { summary: "文档概述" }));
  };
  const markdown = "# Title\n\n[Docs][docs]\n\n[docs]: https://example.com\n";
  const translated = await translateReadme(credentials, markdown, new AbortController().signal, () => undefined);
  expect(translated.translation).toContain("[docs]: https://example.com");
});
