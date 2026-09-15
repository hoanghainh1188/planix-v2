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
