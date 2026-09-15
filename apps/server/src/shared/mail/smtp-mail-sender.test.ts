import { createServer, type Server, type Socket } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SMTP_TIMEOUTS, SmtpMailSender } from './smtp-mail-sender.ts';

let server: Server;
const sockets = new Set<Socket>();
let port = 0;

beforeAll(async () => {
  // Accepts connections but never sends the SMTP greeting: a hung mail server.
  server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(async () => {
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('SMTP timeouts (security review: hung mail server)', () => {
  it('uses bounded default timeouts', () => {
    expect(DEFAULT_SMTP_TIMEOUTS).toEqual({ connectionMs: 10_000, greetingMs: 10_000, socketMs: 20_000 });
  });

  it('gives up on a server that never greets instead of waiting minutes', async () => {
    const sender = new SmtpMailSender({
      smtpUrl: `smtp://127.0.0.1:${port}`,
      from: 'Planix <no-reply@planix.test>',
      timeouts: { connectionMs: 500, greetingMs: 300, socketMs: 1_000 },
    });
    const started = Date.now();
    await expect(
      sender.send('someone@example.test', {
        kind: 'passwordReset',
        locale: 'en',
        resetUrl: 'https://app.planix.test/password-reset/tok',
      }),
    ).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(3_000);
    await sender.close();
  });
});
