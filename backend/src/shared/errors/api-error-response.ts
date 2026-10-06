type ErrorPayload = {
  message?: string | string[];
  code?: string;
  details?: unknown;
};

const DEFAULT_CODES: Record<number, string> = {
  400: "VALIDATION_ERROR",
  401: "AUTHENTICATION_REQUIRED",
  403: "PERMISSION_DENIED",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
};

export function buildApiErrorResponse(input: {
  statusCode: number;
  source: string | object;
  path: string;
  timestamp?: Date;
}) {
  const payload: ErrorPayload =
    typeof input.source === "string" ? { message: input.source } : input.source;
  const messages = Array.isArray(payload.message)
    ? payload.message
    : payload.message
      ? [payload.message]
      : [];

  if (input.statusCode === 429) {
    messages[0] = "Trop de tentatives. Réessayez dans une minute.";
  }

  return {
    statusCode: input.statusCode,
    code:
      payload.code ??
      DEFAULT_CODES[input.statusCode] ??
      (input.statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED"),
    message:
      messages[0] ??
      (input.statusCode >= 500
        ? "Une erreur interne est survenue."
        : "La requête n’a pas pu être traitée."),
    details: payload.details ?? messages.slice(1),
    timestamp: (input.timestamp ?? new Date()).toISOString(),
    path: input.path,
  };
}
