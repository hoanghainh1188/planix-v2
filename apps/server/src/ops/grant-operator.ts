import { userInfo } from 'node:os';
import { parseArgs } from 'node:util';
import { PASSWORD_RESET_TTL_MS } from '../features/organization-access/auth/password-reset.service.ts';
import { PasswordHasher } from '../shared/auth/password-hasher.ts';
import { generateToken, hashToken } from '../shared/auth/secure-token.ts';
import { systemClock, type ClockPort } from '../shared/clock/clock.ts';
import type { Database } from '../shared/db/client.ts';
import type { MailLocale, MailSender } from '../shared/mail/mail-sender.ts';

/** `--create`: make the account when it does not exist yet (decision 2026-09-15-005-first-platform-operator). */
export interface CreateOperatorAccount {
  readonly mailSender: MailSender;
  readonly appBaseUrl: string;
  readonly locale?: MailLocale;
  readonly clock?: ClockPort;
}

export interface GrantOperatorResult {
  readonly userId: string;
  readonly alreadyGranted: boolean;
  readonly accountCreated: boolean;
}

/**
 * Operations CLI: grant the Platform Operator role (research R11). No UI exists for this on purpose.
 * Usage: npm run ops:grant-operator -- --email operator@example.com [--create [--locale vi|en]]
 * Runs with the owner role because platform_operator_grant is not writable by application roles.
 * With `create`, a missing account is created with an unusable password and its owner receives a password reset
 * link: a fresh install has no other way to get its first Operator. The link is never printed or logged.
 */
export async function grantOperator(
  db: Database,
  email: string,
  grantedBy: string,
  options: { create?: CreateOperatorAccount } = {},
): Promise<GrantOperatorResult> {
  const { create } = options;
  // Hashed before the transaction: argon2 is slow and the secret is thrown away, so nobody can sign in with it.
  const unusablePasswordHash = create === undefined ? undefined : await new PasswordHasher().hash(generateToken());
  const resetToken = generateToken();

  const client = await db.ownerPool.connect();
  let result: GrantOperatorResult;
  try {
    await client.query('BEGIN');
    const user = await client.query<{ id: string }>('SELECT id FROM app_user WHERE email = $1', [email]);
    let userId = user.rows[0]?.id;
    let accountCreated = false;
    if (userId === undefined) {
      if (create === undefined || unusablePasswordHash === undefined) {
        throw new Error(
          `No account with email ${email}; the operator must accept an invitation first, or pass --create to make the account`,
        );
      }
      const now = (create.clock ?? systemClock).now();
      const inserted = await client.query<{ id: string }>(
        'INSERT INTO app_user (email, password_hash, locale, created_at, updated_at) VALUES ($1, $2, $3, $4, $4) RETURNING id',
        [email, unusablePasswordHash, create.locale ?? 'vi', now],
      );
      userId = inserted.rows[0]!.id;
      await client.query(
        'INSERT INTO password_reset_token (user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4)',
        [userId, hashToken(resetToken), new Date(now.getTime() + PASSWORD_RESET_TTL_MS), now],
      );
      accountCreated = true;
    }
    const granted = await client.query(
      'INSERT INTO platform_operator_grant (user_id, granted_by) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
      [userId, grantedBy],
    );
    const alreadyGranted = granted.rowCount === 0;
    if (!alreadyGranted) {
      await client.query(
        `INSERT INTO audit_entry (organization_id, actor_user_id, actor_kind, action, target_type, target_id, outcome, after)
         VALUES (NULL, NULL, 'system', 'platform.operator.grant', 'appUser', $1, 'succeeded', $2::jsonb)`,
        [userId, JSON.stringify(accountCreated ? { grantedBy, accountCreated } : { grantedBy })],
      );
    }
    await client.query('COMMIT');
    result = { userId, alreadyGranted, accountCreated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  if (result.accountCreated && create !== undefined) {
    // After commit: an email is never sent for an account that was rolled back.
    try {
      await create.mailSender.send(email, {
        kind: 'passwordReset',
        locale: create.locale ?? 'vi',
        resetUrl: `${create.appBaseUrl}/password-reset/${resetToken}`,
      });
    } catch {
      // The account exists, so the normal reset flow recovers. The mail error is not repeated: it may carry the link.
      throw new Error(
        `The account was created and granted platform operator, but the password reset email to ${email} could not be sent; use "Forgot password" on the sign-in page to get a new link`,
      );
    }
  }
  return result;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, create: { type: 'boolean' }, locale: { type: 'string' } },
  });
  if (values.email === undefined) {
    throw new Error('Usage: npm run ops:grant-operator -- --email <email> [--create [--locale vi|en]]');
  }
  if (values.locale !== undefined && values.locale !== 'vi' && values.locale !== 'en') {
    throw new Error('--locale must be vi or en');
  }
  const { loadServerConfig } = await import('../config.ts');
  const { createDatabase } = await import('../shared/db/client.ts');
  const { SmtpMailSender } = await import('../shared/mail/smtp-mail-sender.ts');
  const config = loadServerConfig();
  const db = createDatabase(config.databaseUrls);
  const mailSender = values.create ? new SmtpMailSender({ smtpUrl: config.smtpUrl, from: config.mailFrom }) : undefined;
  try {
    const result = await grantOperator(db, values.email, userInfo().username, {
      ...(mailSender === undefined
        ? {}
        : {
            create: {
              mailSender,
              appBaseUrl: config.app.appBaseUrl,
              ...(values.locale === undefined ? {} : { locale: values.locale }),
            },
          }),
    });
    const outcome = result.accountCreated
      ? 'Created the account and granted platform operator; a password reset link was emailed'
      : result.alreadyGranted
        ? 'Already an operator'
        : 'Granted platform operator';
    process.stdout.write(`${outcome}: ${values.email}\n`);
  } finally {
    await mailSender?.close();
    await db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await main();
  } catch (error) {
    // Message only: no stack or cause, which could carry a reset link from the mail transport.
    process.stderr.write(`${error instanceof Error ? error.message : 'Unexpected error'}\n`);
    process.exitCode = 1;
  }
}
