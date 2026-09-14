import { Catch, HttpException, HttpStatus, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { httpStatusOf, type ErrorCode } from '@planix/core/shared/errors/error-codes.ts';
import { DomainError, type ErrorParams } from './domain-error.ts';

const CODE_BY_HTTP_STATUS: Readonly<Partial<Record<number, ErrorCode>>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'AUTH_REQUIRED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'RESOURCE_NOT_FOUND',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/** Global filter: every error leaves the API as a stable code (contracts/api.md), never a message or stack. */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  readonly #logger = new Logger('DomainErrorFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, code, params } = this.#resolve(exception);
    if (status >= 500) {
      // Stack only; request bodies and params are never logged here (research R14).
      this.#logger.error(exception instanceof Error ? exception.stack : 'Non-error thrown');
    }
    response.status(status).json({ error: { code, params } });
  }

  #resolve(exception: unknown): { status: number; code: ErrorCode; params: ErrorParams } {
    if (exception instanceof DomainError) {
      return { status: httpStatusOf(exception.code), code: exception.code, params: exception.params };
    }
    if (exception instanceof HttpException) {
      const code = CODE_BY_HTTP_STATUS[exception.getStatus()];
      if (code !== undefined) return { status: httpStatusOf(code), code, params: {} };
    }
    return { status: 500, code: 'INTERNAL_ERROR', params: {} };
  }
}
