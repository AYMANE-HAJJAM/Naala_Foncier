import { validateEnvironment } from "./environment.js";

const credentials = {
  DATABASE_URL: "postgresql://example.invalid/naala",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
};

describe("deployment environment", () => {
  it("starts without a seed password and disables Swagger by default", () => {
    const env = validateEnvironment(credentials);
    expect(env.SWAGGER_ENABLED).toBe("false");
    expect(env.PORT).toBeUndefined();
  });

  it("accepts Render PORT and an exact HTTPS frontend origin", () => {
    const env = validateEnvironment({ ...credentials, NODE_ENV: "production", WEB_ORIGIN: "https://naala.example", PORT: "10000" });
    expect(env.PORT).toBe(10000);
  });

  it.each(["http://localhost:3000", "https://localhost", "https://naala.example/path", "https://naala.example/"])("rejects unsafe production origin %s", (WEB_ORIGIN) => {
    expect(() => validateEnvironment({ ...credentials, NODE_ENV: "production", WEB_ORIGIN })).toThrow("WEB_ORIGIN");
  });

  it("rejects insecure SameSite none in development", () => {
    expect(() => validateEnvironment({ ...credentials, AUTH_COOKIE_SAME_SITE: "none" })).toThrow("SameSite");
  });
});
