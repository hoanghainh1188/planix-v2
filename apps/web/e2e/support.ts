import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { STATE_FILE, type E2eState } from './global-setup.ts';

export const state = (): E2eState => JSON.parse(readFileSync(STATE_FILE, 'utf8')) as E2eState;

interface MailpitMessage {
  readonly ID: string;
  readonly Created: string;
}

/** Waits for the newest email to `to` and returns the first link matching `pathPrefix`. */
export async function linkFromEmail(to: string, pathPrefix: string, after = 0): Promise<string> {
  const api = state().mailpitApi;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const search = (await (await fetch(`${api}/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as {
      messages: MailpitMessage[];
    };
    const newest = [...search.messages].sort((a, b) => b.Created.localeCompare(a.Created))[0];
    if (newest && search.messages.length > after) {
      const message = (await (await fetch(`${api}/message/${newest.ID}`)).json()) as { Text: string };
      const match = new RegExp(`https?://[^\\s]+${pathPrefix.replaceAll('/', '\\/')}[A-Za-z0-9_-]+`).exec(message.Text);
      if (match) return new URL(match[0]).pathname;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`No email to ${to} containing ${pathPrefix}`);
}

export async function emailCount(to: string): Promise<number> {
  const search = (await (
    await fetch(`${state().mailpitApi}/search?query=${encodeURIComponent(`to:${to}`)}`)
  ).json()) as {
    messages: unknown[];
  };
  return search.messages.length;
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

/** SC-003 timing helper: fails when the journey exceeds its budget. */
export async function withinBudget<T>(label: string, budgetMs: number, journey: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const result = await journey();
  const elapsed = Date.now() - started;
  expect(elapsed, `${label} took ${elapsed} ms (budget ${budgetMs} ms)`).toBeLessThanOrEqual(budgetMs);
  return result;
}

export interface SeededAdmin {
  readonly organizationName: string;
  readonly email: string;
  readonly password: string;
}

/** Seeds an organization with one admin straight into the database (owner role), for journeys after onboarding. */
export async function seedOrganizationWithAdmin(label: string): Promise<SeededAdmin> {
  const { default: pg } = await import('pg');
  const { PasswordHasher } = await import('../../server/src/shared/auth/password-hasher.ts');
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const seeded = {
    organizationName: `${label} ${suffix}`,
    email: `admin.${suffix}@${label.toLowerCase()}-e2e.test`,
    password: 'harbor-lantern-e2e',
  };
  const pool = new pg.Pool({ connectionString: state().databaseUrl, max: 1 });
  try {
    const hash = await new PasswordHasher().hash(seeded.password);
    const user = await pool.query<{ id: string }>(
      "INSERT INTO app_user (email, password_hash, locale) VALUES ($1, $2, 'en') RETURNING id",
      [seeded.email, hash],
    );
    const organization = await pool.query<{ id: string }>(
      'INSERT INTO organization (name, created_by_operator_id) VALUES ($1, $2) RETURNING id',
      [seeded.organizationName, user.rows[0]!.id],
    );
    const membership = await pool.query<{ id: string }>(
      'INSERT INTO organization_membership (organization_id, user_id) VALUES ($1, $2) RETURNING id',
      [organization.rows[0]!.id, user.rows[0]!.id],
    );
    await pool.query("INSERT INTO membership_role (organization_id, membership_id, role) VALUES ($1, $2, 'admin')", [
      organization.rows[0]!.id,
      membership.rows[0]!.id,
    ]);
  } finally {
    await pool.end();
  }
  return seeded;
}
