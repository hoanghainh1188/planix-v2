import { expect, test } from '@playwright/test';
import { linkFromEmail, signIn, state, withinBudget } from './support.ts';

const MINUTES = 60_000;
const adminEmail = `admin.${Date.now()}@acme-e2e.test`;
const adminPassword = 'lantern-fjord-e2e';

test.describe.serial('onboarding (Q1 → Q2, Q11, SC-003)', () => {
  test('operator creates an organization and invites the first admin (Q1)', async ({ page }) => {
    const { operator } = state();
    await signIn(page, operator.email, operator.password);

    await withinBudget('create organization + invitation email', 2 * MINUTES, async () => {
      await page.goto('/platform/organizations');
      await page.getByLabel('Organization name').fill('Acme E2E');
      await page.getByLabel('First admin email').fill(adminEmail);
      await page.getByRole('button', { name: 'Create and send invitation' }).click();
      await expect(page.getByRole('cell', { name: 'Acme E2E', exact: true })).toBeVisible();
      await linkFromEmail(adminEmail, '/invitations/');
    });
  });

  test('the invited admin creates an account from the email link (Q2)', async ({ page }) => {
    const link = await linkFromEmail(adminEmail, '/invitations/');
    await withinBudget('accept invitation with account creation', 2 * MINUTES, async () => {
      await page.goto(link);
      await expect(page.getByRole('heading', { name: 'Join Acme E2E' })).toBeVisible();
      await page.getByLabel('Choose a password for your new account').fill('too-short');
      await page.getByRole('button', { name: 'Accept invitation' }).click();
      await expect(page.getByRole('alert')).toContainText('at least 12 characters');
      await page.getByLabel('Choose a password for your new account').fill(adminPassword);
      await page.getByRole('button', { name: 'Accept invitation' }).click();
      await expect(page.getByRole('heading', { name: 'Acme E2E' })).toBeVisible();
    });
  });

  test('an existing account joins a second organization and switches between them (Q11)', async ({ page, browser }) => {
    const operatorPage = await (await browser.newContext()).newPage();
    const { operator } = state();
    await signIn(operatorPage, operator.email, operator.password);
    await operatorPage.goto('/platform/organizations');
    await operatorPage.getByLabel('Organization name').fill('Beta E2E');
    await operatorPage.getByLabel('First admin email').fill(adminEmail);
    await operatorPage.getByRole('button', { name: 'Create and send invitation' }).click();
    await expect(operatorPage.getByRole('cell', { name: 'Beta E2E', exact: true })).toBeVisible();

    await signIn(page, adminEmail, adminPassword);
    await expect(page.getByRole('heading', { name: 'Acme E2E' })).toBeVisible();

    const link = await linkFromEmail(adminEmail, '/invitations/', 1);
    await page.goto(link);
    await expect(page.getByRole('heading', { name: 'Join Beta E2E' })).toBeVisible();
    await page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(page.getByRole('heading', { name: 'Beta E2E' })).toBeVisible();

    await withinBudget('switch organization', 5_000, async () => {
      await page.getByLabel('Organization').selectOption({ label: 'Acme E2E' });
      await expect(page.getByRole('heading', { name: 'Acme E2E' })).toBeVisible();
    });
  });
});
