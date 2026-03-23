import { test, expect } from "@playwright/test";

test("dashboard mobile viewport has no horizontal scroll and renders chart", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/", { waitUntil: "networkidle" });

  const bodyBox = await page.locator("body").boundingBox();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  if (bodyBox) {
    expect(scrollWidth).toBeLessThanOrEqual(Math.ceil(bodyBox.width) + 1);
  }

  await expect(page.locator(".responsive-chart canvas, .responsive-chart svg").first()).toBeVisible();
});

