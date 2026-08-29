import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "../../backend/node_modules/dotenv/lib/main.js";
import { chromium } from "playwright-core";

const backendEnv = dotenv.parse(
  readFileSync(resolve("../backend/.env"), "utf8"),
);
const email = backendEnv.INITIAL_ADMIN_EMAIL;
const password = backendEnv.INITIAL_ADMIN_PASSWORD;
if (!email || !password) throw new Error("Identifiants admin locaux absents.");

const output = resolve("artifacts/responsive-smoke");
mkdirSync(output, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1366, height: 768 },
];

const routes = ["/dashboard", "/requisitions", "/documents", "/calendrier", "/rapports", "/administration/utilisateurs", "/administration/affectations"];
const failures = [];

async function waitForWorkspace(page) {
  await page
    .getByText(/ouverture de l.espace/i)
    .waitFor({ state: "hidden", timeout: 20_000 });
  await page.waitForTimeout(3_000);
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const httpErrors = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith("Failed to load resource:")
    ) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
      httpErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1_000);
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForTimeout(2_000);
  if (page.url().includes("login")) {
    console.log(JSON.stringify({ loginUrl: page.url(), httpErrors, consoleErrors, body: (await page.locator("body").innerText()).slice(0, 500) }));
  }
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 30_000 });
  await waitForWorkspace(page);

  let terrainRoute = null;
  for (const route of routes) {
    await page.goto(`http://localhost:3000${route}`, { waitUntil: "domcontentloaded" });
    await waitForWorkspace(page);
    if (route === "/requisitions") {
      const terrainLink = page.locator('a[href^="/requisitions/"]').first();
      await terrainLink.waitFor({ state: "attached", timeout: 20_000 });
      terrainRoute = await terrainLink.getAttribute("href");
    }
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    if (dimensions.scrollWidth > dimensions.clientWidth + 1) {
      failures.push(`${viewport.name} ${route}: overflow ${dimensions.scrollWidth}/${dimensions.clientWidth}`);
    }
    const slug = route.slice(1).replaceAll("/", "-") || "home";
    await page.screenshot({ path: resolve(output, `${viewport.name}-${slug}.png`), fullPage: true });
  }

  if (terrainRoute) {
    await page.goto(`http://localhost:3000${terrainRoute}`, { waitUntil: "domcontentloaded" });
    await waitForWorkspace(page);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    if (dimensions.scrollWidth > dimensions.clientWidth + 1) {
      failures.push(`${viewport.name} terrain: overflow ${dimensions.scrollWidth}/${dimensions.clientWidth}`);
    }
    await page.screenshot({ path: resolve(output, `${viewport.name}-terrain.png`), fullPage: true });
    for (const tab of ["documents", "oppositions", "judiciaire", "calendrier", "rapports"]) {
      await page.goto(`http://localhost:3000${terrainRoute}?tab=${tab}`, { waitUntil: "domcontentloaded" });
      await waitForWorkspace(page);
      const tabDimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
      if (tabDimensions.scrollWidth > tabDimensions.clientWidth + 1) failures.push(`${viewport.name} terrain-${tab}: overflow ${tabDimensions.scrollWidth}/${tabDimensions.clientWidth}`);
      await page.screenshot({ path: resolve(output, `${viewport.name}-terrain-${tab}.png`), fullPage: true });
    }
  } else {
    failures.push(`${viewport.name}: aucun lien terrain trouvé`);
  }

  if (consoleErrors.length) {
    failures.push(`${viewport.name}: console ${consoleErrors.join(" | ")}`);
  }
  if (httpErrors.length) {
    failures.push(`${viewport.name}: HTTP ${httpErrors.join(" | ")}`);
  }
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Responsive smoke: PASS (390x844, 768x1024, 1366x768)");
}
