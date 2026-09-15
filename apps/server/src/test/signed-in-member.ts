import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Database } from '../shared/db/client.ts';
import { Browser } from './browser.ts';
import { seedMembership, seedUserWithPassword } from './seed.ts';

export const MEMBER_PASSWORD = 'lantern-fjord-42';

export interface SignedInMember {
  readonly browser: Browser;
  readonly userId: string;
  readonly membershipId: string;
  readonly email: string;
}

/** Seeds a user with one membership and signs them in (their only organization becomes the active one). */
export async function signedInMember(
  app: INestApplication,
  db: Database,
  organizationId: string,
  roles: readonly string[],
  options: { locale?: 'vi' | 'en'; email?: string } = {},
): Promise<SignedInMember> {
  const email = options.email ?? `member-${randomUUID().slice(0, 8)}@acme.test`;
  const userId = await seedUserWithPassword(db, email, MEMBER_PASSWORD, { locale: options.locale ?? 'vi' });
  const membershipId = await seedMembership(db, organizationId, userId, roles);
  const browser = new Browser(app);
  const login = await browser.login(email, MEMBER_PASSWORD);
  if (login.status !== 200) throw new Error(`login failed for ${email}: ${login.status}`);
  return { browser, userId, membershipId, email };
}
