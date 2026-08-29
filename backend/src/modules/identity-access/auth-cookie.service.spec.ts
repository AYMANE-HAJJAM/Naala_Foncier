import { AuthCookieService } from "./auth-cookie.service.js";
import { jest } from "@jest/globals";

describe("AuthCookieService", () => {
  function service(values: Record<string, string>) {
    return new AuthCookieService({
      get: (key: string, fallback?: string) => values[key] ?? fallback,
    } as never);
  }

  it("aligns cookie expiration with JWT_REFRESH_TTL", () => {
    const cookies = service({ NODE_ENV: "development", JWT_REFRESH_TTL: "2h" });
    const response = { cookie: jest.fn() };
    cookies.set(response as never, "refresh-token");
    expect(response.cookie).toHaveBeenCalledWith(
      "naala_refresh",
      "refresh-token",
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/api/auth",
        maxAge: 7_200_000,
      }),
    );
  });

  it("always uses a secure cookie in production", () => {
    const cookies = service({
      NODE_ENV: "production",
      JWT_REFRESH_TTL: "7d",
      AUTH_COOKIE_SECURE: "false",
      AUTH_COOKIE_SAME_SITE: "none",
    });
    const response = { cookie: jest.fn() };
    cookies.set(response as never, "refresh-token");
    expect(response.cookie).toHaveBeenCalledWith(
      "naala_refresh",
      "refresh-token",
      expect.objectContaining({ secure: true, sameSite: "none" }),
    );
  });

  it("clears the cookie with the same scope", () => {
    const cookies = service({
      NODE_ENV: "production",
      JWT_REFRESH_TTL: "7d",
      AUTH_COOKIE_DOMAIN: ".example.test",
    });
    const response = { clearCookie: jest.fn() };
    cookies.clear(response as never);
    expect(response.clearCookie).toHaveBeenCalledWith(
      "naala_refresh",
      expect.objectContaining({
        path: "/api/auth",
        domain: ".example.test",
        secure: true,
      }),
    );
  });
});
