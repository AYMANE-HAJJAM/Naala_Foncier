import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

interface ErrorPayload { message?: string | string[]; code?: string; details?: unknown[] }

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const isHttp = exception instanceof HttpException;
    if (!isHttp) {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(error.message, error.stack);
    }
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const source = isHttp ? exception.getResponse() : {};
    const payload: ErrorPayload = typeof source === "string" ? { message: source } : (source);
    const messages = Array.isArray(payload.message) ? payload.message : payload.message ? [payload.message] : [];
    if (statusCode === 429) messages[0] = "Trop de tentatives. Reessayez dans une minute.";
    response.status(statusCode).json({
      statusCode,
      code: payload.code ?? (statusCode === 400 ? "VALIDATION_ERROR" : statusCode === 401 ? "AUTHENTICATION_REQUIRED" : statusCode === 403 ? "PERMISSION_DENIED" : statusCode === 404 ? "NOT_FOUND" : statusCode === 429 ? "RATE_LIMITED" : "INTERNAL_ERROR"),
      message: messages[0] ?? (statusCode >= 500 ? "Une erreur interne est survenue." : "La requête n’a pas pu être traitée."),
      details: payload.details ?? messages.slice(1),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
