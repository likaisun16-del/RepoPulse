import { expect, test } from "@playwright/test";

import { resolveMarkdownImageUrl } from "../src/components/markdown-content";

test("README 图片解析为可访问的 GitHub raw 地址", () => {
  const baseUrl = "https://github.com/acme/project/blob/main/docs/README.md";

  expect(resolveMarkdownImageUrl("../assets/logo.png", baseUrl)).toBe(
    "https://github.com/acme/project/raw/main/assets/logo.png",
  );
  expect(resolveMarkdownImageUrl("https://github.com/acme/project/blob/main/logo.png", baseUrl)).toBe(
    "https://github.com/acme/project/raw/main/logo.png",
  );
  expect(resolveMarkdownImageUrl("javascript:alert(1)", baseUrl)).toBeUndefined();
});
