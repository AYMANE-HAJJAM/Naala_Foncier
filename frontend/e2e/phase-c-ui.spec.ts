import { expect, test } from "@playwright/test";
import { qa } from "./qa-env";

test("ADMIN: navigation, wizard et responsive sans overflow", async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1_000);
  await page.locator('input[autocomplete="email"]').fill(qa.QA_ADMIN_EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(qa.QA_ADMIN_PASSWORD);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"));

  const viewports = [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ];
  const routes = ["/dashboard", "/requisitions", "/calendrier", "/rapports", "/notifications", "/administration/utilisateurs", "/administration/affectations"];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await page.getByText(/ouverture de l.espace/i).waitFor({ state: "hidden", timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      await expect(page, `${viewport.width}x${viewport.height} ${route}`).not.toHaveURL(/\/login/);
      await expect(page.locator("body")).not.toContainText("Unhandled exception");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${viewport.width}x${viewport.height} ${route}`).toBeLessThanOrEqual(1);
    }
  }

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/requisitions");
  await page.getByRole("button", { name: /nouveau terrain/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(/pièces sources/i);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  const terrainLink = page.locator('a[href^="/requisitions/"]').filter({ hasText: qa.QA_REQUISITION_REFERENCE }).first();
  await expect(terrainLink).toBeVisible();
  await terrainLink.click();
  await expect(page.getByText(qa.QA_REQUISITION_REFERENCE, { exact: false }).first()).toBeVisible();
  for (const tab of ["Documents", "Oppositions", "Suivi judiciaire", "Calendrier", "Rapports"]) {
    await page.getByRole("button", { name: new RegExp(tab, "i") }).click();
    await expect(page.locator("body")).not.toContainText("Unhandled exception");
  }
});
