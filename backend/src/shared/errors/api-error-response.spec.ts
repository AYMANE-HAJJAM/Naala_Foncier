import { buildApiErrorResponse } from "./api-error-response.js";

describe("buildApiErrorResponse", () => {
  const timestamp = new Date("2026-08-29T10:00:00.000Z");

  it("preserves a business code and first validation message", () => {
    expect(
      buildApiErrorResponse({
        statusCode: 409,
        source: { code: "REFERENCE_EXISTS", message: ["Référence déjà utilisée", "Détail"] },
        path: "/api/requisitions",
        timestamp,
      }),
    ).toEqual({
      statusCode: 409,
      code: "REFERENCE_EXISTS",
      message: "Référence déjà utilisée",
      details: ["Détail"],
      timestamp: timestamp.toISOString(),
      path: "/api/requisitions",
    });
  });

  it("does not expose an internal exception message", () => {
    const response = buildApiErrorResponse({
      statusCode: 500,
      source: {},
      path: "/api/private",
      timestamp,
    });
    expect(response.code).toBe("INTERNAL_ERROR");
    expect(response.message).toBe("Une erreur interne est survenue.");
  });

  it("normalizes rate limit errors", () => {
    const response = buildApiErrorResponse({
      statusCode: 429,
      source: { message: "ThrottlerException" },
      path: "/api/auth/login",
      timestamp,
    });
    expect(response).toMatchObject({
      code: "RATE_LIMITED",
      message: "Trop de tentatives. Réessayez dans une minute.",
    });
  });
});
