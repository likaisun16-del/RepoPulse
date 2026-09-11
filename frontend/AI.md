# Personal AI configuration

The settings page is `/settings/ai`. Credentials stay in the browser's `repopulse-ai-v1` localStorage entry. Only a user-initiated test or translation sends them to same-origin Next.js endpoints; they are forwarded to a fixed vendor endpoint and are never intentionally logged or persisted on the server. This is not encrypted browser storage. Use HTTPS and trusted devices in production. Vendor data retention policies still apply.

`POST /api/ai/test` accepts `{ provider, model, apiKey }`. `POST /api/ai/readme` additionally accepts `markdown` and returns newline-delimited JSON progress, result, or error events. Failed validation uses a JSON error response. No arbitrary endpoints or model names are accepted. Qwen uses the mainland China endpoint and requires a matching API key.

Generation preserves Markdown block order, copies standalone code/HTML/reference blocks verbatim, checks code and link destinations, and rejects empty/truncated responses. Documents are limited to 100,000 UTF-16 code units and individual translatable blocks to 16,000. The task deadline is 10 minutes; each upstream request has a 90-second timeout. Cancellation propagates to upstream fetch. No automatic paid retries occur. Results are kept only in the mounted README component, indexed by content/provider/model.

Deployment must allow streaming responses and a 600-second request duration. Reverse proxies must not buffer NDJSON or record request bodies/credential headers. No database migration or Python worker changes are required.

## Model sources

The fixed catalogue is maintained in `src/lib/ai/catalog.ts`; verify IDs and regional availability before changing it. Official documentation consulted during implementation:

- OpenAI: https://developers.openai.com/api/docs/models/gpt-4.1-mini and https://developers.openai.com/api/docs/models/gpt-4.1
- DeepSeek: https://api-docs.deepseek.com/ and https://api-docs.deepseek.com/guides/thinking_mode/
- Gemini: https://ai.google.dev/gemini-api/docs/models and https://ai.google.dev/api/generate-content
- Claude: https://platform.claude.com/docs/en/models/overview
- Qwen: https://help.aliyun.com/zh/model-studio/qwen-api-reference

Availability depends on the user's vendor account. Tests use mocked vendor responses and do not establish live account access.

## Verification

Run `npm run lint`, `npm run typecheck`, and `npm run build` from `frontend`.
Run `npx playwright test --config playwright.ai.config.ts --project server` for isolated vendor/translation tests.
For the full suite, start the frontend on `127.0.0.1:3001` and a backend with demo data on port 8000, then run `npx playwright test --config playwright.ai.config.ts`. Browser tests mock only the AI responses; they exercise the real settings and README pages. Traces are disabled for this suite so credentials cannot accidentally appear in retained network traces. Test credentials are placeholders.
