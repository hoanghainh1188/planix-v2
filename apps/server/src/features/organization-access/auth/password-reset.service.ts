import { Inject, Injectable, Logger, type BeforeApplicationShutdown } from '@nestjs/common';
import { checkPasswordPolicy } from '@planix/core/features/organization-access/password-policy/password-policy.ts';
import { APP_CONFIG, DATABASE, type AppConfig } from '../../../shared/app-tokens.ts';
import { AUDIT_WRITER, type AuditWriter } from '../../../shared/audit/audit-writer.ts';
import { PASSWORD_HASHER, type PasswordHasher } from '../../../shared/auth/password-hasher.ts';
import { generateToken, hashToken } from '../../../shared/auth/secure-token.ts';
import { SESSION_STORE, type SessionStore } from '../../../shared/auth/session-store.ts';
import { CLOCK, type ClockPort } from '../../../shared/clock/clock.ts';
import { withAnonymousTransaction, type ApplicationDatabase } from '../../../shared/db/client.ts';
import { DomainError } from '../../../shared/errors/domain-error.ts';
import { BackgroundJobs } from '../../../shared/background/background-jobs.ts';
import { MAIL_SENDER, type MailSender } from '../../../shared/mail/mail-sender.ts';

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Password reset by one-time email link (FR-031, decision password-reset). */
@Injectable()
export class PasswordResetService implements BeforeApplicationShutdown {
  constructor(
    @Inject(DATABASE) private readonly db: ApplicationDatabase,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
  ) {}

  readonly #logger = new Logger('PasswordResetService');
  // Never log the error message: it may carry the reset link.
  readonly #jobs = new BackgroundJobs((message) => this.#logger.error(message));

  /**
   * Same response and response time whether or not the email exists (FR-008): the lookup, token write and email
   * all run after the caller has been answered.
   */
  request(email: string): void {
    const now = this.clock.now();
    this.#jobs.run('password reset request', () => this.#issueResetLink(email, now));
  }

  /** Lets in-flight reset requests finish (and send their email) before the application stops (bounded wait). */
  beforeApplicationShutdown(): Promise<void> {
    return this.#jobs.drain();
  }

  async #issueResetLink(email: string, now: Date): Promise<void> {
    const token = generateToken();
    const user = await withAnonymousTransaction(this.db, async (tx) => {
      // Row lock: concurrent requests for one account supersede each other in order.
      const { rows } = await tx.client.query<{ id: string; email: string; locale: 'vi' | 'en' }>(
        'SELECT id, email, locale FROM app_user WHERE email = $1 FOR UPDATE',
        [email],
      );
      const found = rows[0];
      if (found === undefined) return undefined;
      await tx.client.query(
        'UPDATE password_reset_token SET superseded_at = $2 WHERE user_id = $1 AND used_at IS NULL AND superseded_at IS NULL',
        [found.id, now],
      );
      await tx.client.query(
        'INSERT INTO password_reset_token (user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4)',
        [found.id, hashToken(token), new Date(now.getTime() + PASSWORD_RESET_TTL_MS), now],
      );
      await this.audit.record(tx, {
        organizationId: null,
        actorUserId: null,
        actorKind: 'user',
        action: 'auth.password-reset.request',
        targetType: 'appUser',
        targetId: found.id,
        outcome: 'succeeded',
      });
      return found;
    });
    if (user !== undefined) {
      await this.mail.send(user.email, {
        kind: 'passwordReset',
        locale: user.locale,
        resetUrl: `${this.config.appBaseUrl}/password-reset/${token}`,
      });
    }
  }

  async confirm(token: string, newPassword: string): Promise<void> {
    const now = this.clock.now();
    const userId = await withAnonymousTransaction(this.db, async (tx) => {
      const { rows } = await tx.client.query<{
        id: string;
        user_id: string;
        expires_at: Date;
        used_at: Date | null;
        superseded_at: Date | null;
      }>(
        'SELECT id, user_id, expires_at, used_at, superseded_at FROM password_reset_token WHERE token_hash = $1 FOR UPDATE',
        [hashToken(token)],
      );
      const row = rows[0];
      if (
        row === undefined ||
        row.used_at !== null ||
        row.superseded_at !== null ||
        row.expires_at.getTime() <= now.getTime()
      ) {
        throw new DomainError('TOKEN_INVALID_OR_EXPIRED');
      }
      const policy = checkPasswordPolicy(newPassword);
      if (!policy.ok) throw new DomainError('PASSWORD_POLICY_VIOLATION', { rule: policy.rule });

      const passwordHash = await this.hasher.hash(newPassword);
      await tx.client.query(
        'UPDATE app_user SET password_hash = $2, failed_login_count = 0, locked_until = NULL, updated_at = $3 WHERE id = $1',
        [row.user_id, passwordHash, now],
      );
      await tx.client.query('UPDATE password_reset_token SET used_at = $2 WHERE id = $1', [row.id, now]);
      await this.audit.record(tx, {
        organizationId: null,
        actorUserId: row.user_id,
        actorKind: 'user',
        action: 'auth.password-reset.confirm',
        targetType: 'appUser',
        targetId: row.user_id,
        outcome: 'succeeded',
      });
      return row.user_id;
    });
    await this.sessions.deleteAllForUser(userId);
  }
}
