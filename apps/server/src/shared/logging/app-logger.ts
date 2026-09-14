import type { LoggerService } from '@nestjs/common';

export type LogSink = (line: string) => void;

const stdoutSink: LogSink = (line) => process.stdout.write(`${line}\n`);

/** Structured JSON logger used as the NestJS logger (research R14). Callers pass already-redacted data. */
export class AppLogger implements LoggerService {
  constructor(private readonly sink: LogSink = stdoutSink) {}

  event(event: string, fields: Readonly<Record<string, unknown>>): void {
    this.#write('info', { event, ...fields });
  }

  log(message: unknown, context?: string): void {
    this.#write('info', { message: String(message), context });
  }

  error(message: unknown, stackOrContext?: string, context?: string): void {
    this.#write('error', {
      message: String(message),
      stack: context === undefined ? undefined : stackOrContext,
      context: context ?? stackOrContext,
    });
  }

  warn(message: unknown, context?: string): void {
    this.#write('warn', { message: String(message), context });
  }

  debug(message: unknown, context?: string): void {
    this.#write('debug', { message: String(message), context });
  }

  verbose(message: unknown, context?: string): void {
    this.#write('verbose', { message: String(message), context });
  }

  #write(level: string, fields: Readonly<Record<string, unknown>>): void {
    this.sink(JSON.stringify({ time: new Date().toISOString(), level, ...fields }));
  }
}
