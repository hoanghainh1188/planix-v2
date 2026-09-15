import { Catch, HttpException, HttpStatus, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { httpStatusOf, type ErrorCode } from '@planix/core/shared/errors/error-codes.ts';
import { DomainError, type ErrorParams } from './domain-error.ts';

const CODE_BY_HTTP_STATUS: Readonly<Partial<Record<number, ErrorCode>>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'AUTH_REQUIRED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'RESOURCE_NOT_FOUND',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/**
 * Body parser errors are plain errors carrying `type` and `status` (e.g. 413 `entity.too.large`, 415
 * `charset.unsupported`), not HttpExceptions. Nest turns only SyntaxError/URIError into 400 by itself.
 */
function bodyParserErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { type, status } = exception as { type?: unknown; status?: unknown };
  if (typeof type !== 'string' || typeof status !== 'number') return undefined;
  return status >= 400 && status < 500 ? status : undefined;
}

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
    const bodyStatus = bodyParserErrorStatus(exception);
    if (bodyStatus === HttpStatus.PAYLOAD_TOO_LARGE) return { status: 413, code: 'PAYLOAD_TOO_LARGE', params: {} };
    // Other client-side body errors (unsupported charset or encoding…) have no code of their own in the contract.
    if (bodyStatus !== undefined) return { status: 400, code: 'VALIDATION_FAILED', params: {} };
    return { status: 500, code: 'INTERNAL_ERROR', params: {} };
  }
}
