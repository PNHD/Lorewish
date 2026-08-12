import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/play/");
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
});

test("Quick Start and Advanced Setup remain public, guest-first, responsive, and draft-safe", async ({ page }) => {
  let anonymousSignups = 0;
  page.on("request", (request) => {
    if (request.url().includes("/auth/v1/signup")) anonymousSignups += 1;
  });
  await expect(page.getByText("Start a new story", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Quick Start" })).toBeChecked();
  await expect(page.getByText("Starter", { exact: true })).toBeVisible();

  await page.getByRole("radio", { name: "Advanced Setup" }).click();
  await expect(page.getByLabel("Premise")).toBeVisible();
  await page.getByLabel("Premise").fill("A lighthouse remembers every visitor.");
  await page.getByRole("radio", { name: "Tiếng Việt" }).nth(1).click();
  await page.getByRole("button", { name: "Vietnamese forms of address" }).click();
  await page.getByRole("radio", { name: "anh / em" }).click();
  await expect(page.getByRole("radio", { name: "anh / em" })).toBeChecked();

  await page.reload();
  await expect(page.getByRole("radio", { name: "Advanced Setup" })).toBeChecked();
  await expect(page.getByLabel("Premise")).toHaveValue("A lighthouse remembers every visitor.");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  expect(anonymousSignups).toBe(0);

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test("manual UI language switch renders Vietnamese setup copy", async ({ page }) => {
  await page.getByLabel("Language").getByRole("radio", { name: "Tiếng Việt" }).click();
  await expect(page.getByText("Bắt đầu một câu chuyện mới", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Thiết lập nâng cao" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bắt đầu", exact: true })).toBeVisible();
});

test("Home -> Setup client-side navigation, EN/VI persistence, and browser back/forward stay console-clean (LW-W5-R1-R1)", async ({ page }) => {
  // Regression guard for a hydration console error (React #418) reported
  // after a live production smoke pass. Extensive independent reproduction
  // (local dev server, exact new-story submit flow, and this exact sequence
  // run repeatedly against real production with Playwright) never
  // reproduced it — every fresh session and every navigation tested here
  // came back clean, which is itself the evidence this test locks in: if a
  // future change ever does introduce a real client/server markup
  // mismatch, this is the assertion that will catch it.
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("button", { name: "START A STORY" })).toBeVisible();

  // Home -> Story Setup, client-side navigation (no full page load).
  await page.getByRole("button", { name: "START A STORY" }).click();
  await expect(page.getByText("Start a new story", { exact: true })).toBeVisible();

  // EN -> VI, client re-render, then a real reload to prove persistence.
  await page.getByLabel("Language").getByRole("radio", { name: "Tiếng Việt" }).click();
  await expect(page.getByText("Bắt đầu một câu chuyện mới", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Bắt đầu một câu chuyện mới", { exact: true })).toBeVisible();

  // VI -> EN again, then real browser back/forward (popstate), not just
  // in-app links.
  await page.getByLabel("Ngôn ngữ").getByRole("radio", { name: "English" }).click();
  await expect(page.getByText("Start a new story", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "START A STORY" })).toBeVisible();
  await page.goForward();
  await expect(page.getByText("Start a new story", { exact: true })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
