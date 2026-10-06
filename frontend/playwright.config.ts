import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readEnv(path: string) {
  if (!existsSync(path)) throw new Error(`Environnement QA absent: ${path}`);
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

const qa = readEnv(resolve(__dirname, "../.phase-c-qa.env"));
Object.assign(process.env, qa);
const authOnly =
  process.env.npm_lifecycle_event === "test:e2e:auth" ||
  process.argv.some((argument) => argument.includes("auth.spec"));
const apiPort = authOnly ? 3101 : 3201;
const webPort = authOnly ? 3100 : 3200;
const apiUrl = `http://localhost:${apiPort}`;
const webUrl = `http://localhost:${webPort}`;
process.env.E2E_API_BASE_URL = `${apiUrl}/api`;
const definedProcessEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: webUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      // A built server is stable even when local audit scripts update JSON files.
      command: `${npmCommand} --prefix ../backend run build && ${npmCommand} --prefix ../backend start`,
      url: `${apiUrl}/api/openapi.json`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...definedProcessEnv,
        ...qa,
        API_PORT: String(apiPort),
        WEB_ORIGIN: webUrl,
        EXPECTED_DATABASE_SCHEMA: qa.QA_SCHEMA,
        EXPECTED_DATABASE_NAME: qa.QA_DATABASE,
        SWAGGER_ENABLED: "true",
        JWT_ACCESS_TTL: authOnly ? "10s" : "15m",
        CLOUDINARY_UPLOAD_FOLDER: "naala-foncier/qa-phase-c",
      },
    },
    {
      // Run suites successively: the shared QA build must have only one writer.
      command: `${npmCommand} run dev -- -p ${webPort}`,
      url: `${webUrl}/login`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...definedProcessEnv,
        API_INTERNAL_URL: apiUrl,
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
  ],
});
