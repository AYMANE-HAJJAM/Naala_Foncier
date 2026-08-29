import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { qa } from "./qa-env";

const apiBase = "http://localhost:3101/api";

async function loginUi(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

async function adminToken(request: APIRequestContext) {
  const response = await request.post(`${apiBase}/auth/login`, {
    data: { email: qa.QA_ADMIN_EMAIL, password: qa.QA_ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).accessToken as string;
}

test.describe.serial("Authentication", () => {
  test("unauthenticated access redirects to login without a loop", async ({ page }) => {
    await page.goto("/requisitions");
    await page.waitForURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("ADMIN login, refresh-cookie restore and logout", async ({ page }) => {
    await loginUi(page, qa.QA_ADMIN_EMAIL, qa.QA_ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/$/);

    await page.evaluate(() => sessionStorage.removeItem("naala-access-token"));
    await page.reload();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Tableau de bord", { exact: true }).first()).toBeVisible();

    await page.locator("header .group").hover();
    await page.getByRole("button", { name: /se d.connecter/i }).click();
    await page.waitForURL(/\/login$/);
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("USER login and ADMIN route rejection", async ({ page }) => {
    await loginUi(page, qa.QA_ASSIGNED_EMAIL, qa.QA_ASSIGNED_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/administration");
    await page.waitForURL(/\/forbidden$/);
    await expect(page.getByRole("heading", { name: /acc.s non autoris/i })).toBeVisible();
  });

  test("invalid credentials show a user-safe error", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[autocomplete="email"]').fill(qa.QA_ADMIN_EMAIL);
    await page.locator('input[autocomplete="current-password"]').fill("wrong-password");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await expect(
      page.getByText("Adresse e-mail ou mot de passe incorrect.", { exact: true }),
    ).toBeVisible();
  });

  test("concurrent expired requests use a single refresh", async ({ page }) => {
    await loginUi(page, qa.QA_ADMIN_EMAIL, qa.QA_ADMIN_PASSWORD);
    let refreshRequests = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/auth/refresh") {
        refreshRequests += 1;
      }
    });

    await page.waitForTimeout(10_500);
    await page.locator('a[href="/administration"]').first().click();
    await page.locator('a[href="/administration/utilisateurs"]').click();
    await expect(page).toHaveURL(/\/administration\/utilisateurs$/);
    await expect(page.getByRole("heading", { name: /utilisateurs/i })).toBeVisible();
    await expect.poll(() => refreshRequests).toBe(1);
  });

  test("logout clears ADMIN cache before USER login", async ({ page }) => {
    await loginUi(page, qa.QA_ADMIN_EMAIL, qa.QA_ADMIN_PASSWORD);
    await page.goto("/administration/utilisateurs");
    await expect(page.getByText(qa.QA_ADMIN_EMAIL, { exact: true })).toBeVisible();

    await page.locator("header .group").hover();
    await page.getByRole("button", { name: /se d.connecter/i }).click();
    await page.waitForURL(/\/login$/);

    const userRequests: string[] = [];
    page.on("request", (request) => userRequests.push(new URL(request.url()).pathname));
    await page.locator('input[autocomplete="email"]').fill(qa.QA_ASSIGNED_EMAIL);
    await page.locator('input[autocomplete="current-password"]').fill(qa.QA_ASSIGNED_PASSWORD);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL(/\/dashboard$/);

    await expect(page.getByText(qa.QA_ADMIN_EMAIL, { exact: true })).toHaveCount(0);
    expect(userRequests).not.toContain("/api/users");
  });

  test("disabled account is rejected with the dedicated message", async ({ page, request }) => {
    const token = await adminToken(request);
    const headers = { Authorization: `Bearer ${token}` };
    const usersResponse = await request.get(`${apiBase}/users`, { headers });
    expect(usersResponse.status()).toBe(200);
    const users = (await usersResponse.json()) as Array<{ id: string; email: string }>;
    const target = users.find((user) => user.email === qa.QA_UNASSIGNED_EMAIL);
    expect(target).toBeTruthy();

    await request.patch(`${apiBase}/users/${target!.id}/deactivate`, { headers });
    try {
      await page.goto("/login");
      await page.locator('input[autocomplete="email"]').fill(qa.QA_UNASSIGNED_EMAIL);
      await page.locator('input[autocomplete="current-password"]').fill(qa.QA_UNASSIGNED_PASSWORD);
      await page.getByRole("button", { name: /se connecter/i }).click();
      await expect(
        page.getByText("Votre compte est desactive. Contactez l'administrateur.", {
          exact: true,
        }),
      ).toBeVisible();
    } finally {
      await request.patch(`${apiBase}/users/${target!.id}/activate`, { headers });
    }
  });
});
