import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/play/");
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
});

test("Quick Start and Advanced Setup remain public, responsive, and draft-safe", async ({ page }) => {
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
  await expect(page.getByRole("button", { name: "Sign in to start" })).toBeVisible();

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test("manual UI language switch renders Vietnamese setup copy", async ({ page }) => {
  await page.getByLabel("Language").getByRole("radio", { name: "Tiếng Việt" }).click();
  await expect(page.getByText("Bắt đầu một câu chuyện mới", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Thiết lập nâng cao" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng nhập để bắt đầu" })).toBeVisible();
});
