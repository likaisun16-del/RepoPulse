import { expect, type Page, test } from "@playwright/test";

async function enterRanking(page: Page) {
  const startButton = page.getByRole("button", { name: "现在开始" });
  if (await startButton.isVisible()) await startButton.click();
}

test("首次进入先介绍数据口径，确认后记住选择", async ({ page }, testInfo) => {
  await page.goto("/?period=7");

  const dialog = page.getByRole("dialog", { name: "先了解数据，再发现增长。" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("净增长 = 截止 Star − 起点 Star")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("methodology-onboarding.png"),
    fullPage: false,
    animations: "disabled",
    caret: "initial",
  });
  await dialog.getByRole("button", { name: "现在开始" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "开源项目增长榜" })).toBeVisible();

  await page.reload();
  await expect(dialog).toBeHidden();
});

test("小灯开关可切换并记住深浅主题", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("theme-test-initialized")) return;
    localStorage.setItem("repopulse-theme", "light");
    sessionStorage.setItem("theme-test-initialized", "1");
  });
  await page.goto("/?period=7");
  await enterRanking(page);

  const themeToggle = page.getByRole("button", { name: "切换深色/浅色模式" });
  const initialTheme = await page.locator("html").getAttribute("data-theme");
  await themeToggle.click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    initialTheme === "dark" ? "light" : "dark",
  );
  await page.screenshot({
    path: testInfo.outputPath("ranking-dark.png"),
    fullPage: true,
    animations: "disabled",
    caret: "initial",
  });

  const selectedTheme = await page.locator("html").getAttribute("data-theme");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", selectedTheme ?? "light");
});

test("榜单支持周期切换、筛选和详情跳转", async ({ page }, testInfo) => {
  await page.goto("/?period=7");
  await enterRanking(page);

  await expect(page.getByRole("heading", { name: "开源项目增长榜" })).toBeVisible();
  await expect(page.getByRole("button", { name: "7 天" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(() => page.locator(".ranking-table tbody tr").count()).toBeGreaterThan(0);
  await expect(page.getByText(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}/)).toBeVisible();
  await expect(page.locator(".repo-cell a").first()).not.toContainText("/");

  await page.screenshot({
    path: testInfo.outputPath("ranking-desktop.png"),
    fullPage: true,
    caret: "initial",
  });

  await page.getByRole("button", { name: "14 天" }).click();
  await expect(page).toHaveURL(/period=14/);
  await expect(page.getByRole("heading", { name: "14 天增长排行" })).toBeVisible();

  await page.getByLabel("编程语言").selectOption("Python");
  await expect(page).toHaveURL(/language=Python/);
  await expect.poll(() => page.locator(".ranking-table tbody tr").count()).toBeGreaterThan(0);

  await page.getByRole("button", { name: "1 天" }).click();
  await expect(page).toHaveURL(/period=1/);
  await expect(page.getByRole("heading", { name: "1 天增长排行" })).toBeVisible();

  await page.getByLabel("每页数量").selectOption("25");
  await expect(page).toHaveURL(/limit=25/);
  await expect.poll(() => page.locator(".ranking-table tbody tr").count()).toBeLessThanOrEqual(25);

  await page.locator(".repo-cell a:visible, .mobile-repo:visible").first().click();
  await expect(page).toHaveURL(/\/repo\//);
  await expect(page.getByText("Star 趋势")).toBeVisible();
  await expect(page.locator(".recharts-responsive-container svg")).toBeVisible();
});

test("移动端榜单无横向溢出", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?period=30");
  await enterRanking(page);

  await expect(page.locator(".mobile-ranking-list")).toBeVisible();
  await expect(page.locator(".desktop-table-wrap")).toBeHidden();
  await expect(page.locator(".mobile-main > strong").first()).not.toContainText("/");
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);

  await page.screenshot({
    path: testInfo.outputPath("ranking-mobile.png"),
    fullPage: true,
    caret: "initial",
  });
});

test("详情页显示本地化简介和仓库名", async ({ page }) => {
  await page.goto("/repo/fastapi/fastapi");

  await expect(page.getByRole("heading", { name: "fastapi", exact: true })).toBeVisible();
  await expect(page.locator(".repo-title span")).toHaveText("fastapi");
  await expect(page.locator(".repo-description")).toContainText("现代、高性能且易于学习");
});

test("详情页返回时恢复榜单页码和筛选条件", async ({ page }) => {
  const returnTo = "/?period=14&language=Python&limit=25&page=2";
  await page.goto(`/repo/fastapi/fastapi?returnTo=${encodeURIComponent(returnTo)}`);

  await page.getByRole("link", { name: "返回增长榜" }).click();
  await expect(page).toHaveURL(/period=14.*language=Python.*limit=25.*page=2/);
  await expect(page.getByRole("heading", { name: "14 天增长排行" })).toBeVisible();
});

test("详情页显示 README 内容和来源", async ({ page }) => {
  await page.goto("/repo/fastapi/fastapi");

  await expect(page.getByRole("heading", { name: "项目文档", exact: true })).toBeVisible();
  await expect(page.locator(".readme-content")).not.toBeEmpty();
  const sourceLink = page.getByRole("link", { name: "在 GitHub 查看 README.md" });
  await expect(sourceLink).toBeVisible();
  await expect(sourceLink).toHaveAttribute(
    "href",
    "https://github.com/fastapi/fastapi/blob/master/README.md",
  );
  await expect(sourceLink).toHaveAttribute("target", "_blank");
  await expect(sourceLink).toHaveAttribute("rel", "noreferrer");
});
