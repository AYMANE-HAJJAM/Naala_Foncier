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
const authOnly = process.argv.some((argument) => argument.includes("auth.spec"));
const definedProcessEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm.cmd --prefix ../backend run dev",
      url: "http://localhost:3101/api/openapi.json",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...definedProcessEnv,
        ...qa,
        API_PORT: "3101",
        WEB_ORIGIN: "http://localhost:3100",
        EXPECTED_DATABASE_SCHEMA: qa.QA_SCHEMA,
        EXPECTED_DATABASE_NAME: qa.QA_DATABASE,
        SWAGGER_ENABLED: "true",
        JWT_ACCESS_TTL: authOnly ? "10s" : "15m",
        CLOUDINARY_UPLOAD_FOLDER: "naala-foncier/qa-phase-c",
      },
    },
    {
      command: "npm.cmd run dev -- -p 3100",
      url: "http://localhost:3100/login",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...definedProcessEnv,
        API_INTERNAL_URL: "http://localhost:3101",
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
  ],
});
