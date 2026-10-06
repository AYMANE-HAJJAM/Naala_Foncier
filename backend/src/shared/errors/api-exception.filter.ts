import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { buildApiErrorResponse } from "./api-error-response.js";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const isHttp = exception instanceof HttpException;
    if (!isHttp) {
      // Driver/provider messages can embed SQL values, credentials or document text.
      const kind = exception instanceof Error ? exception.constructor.name : "UnknownError";
      this.logger.error({ kind, method: request.method, path: request.path }, "Unhandled API error");
    }
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const source = isHttp ? exception.getResponse() : {};
    response.status(statusCode).json(
      buildApiErrorResponse({ statusCode, source, path: request.originalUrl }),
    );
  }
}
