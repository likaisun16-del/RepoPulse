import { expect, test } from "@playwright/test";

test("榜单支持周期切换、筛选和详情跳转", async ({ page }, testInfo) => {
  await page.goto("/?period=7");

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

  await expect(page.getByRole("heading", { name: "fastapi" })).toBeVisible();
  await expect(page.locator(".repo-title span")).toHaveText("fastapi");
  await expect(page.locator(".repo-description")).toContainText("现代、高性能且易于学习");
});
