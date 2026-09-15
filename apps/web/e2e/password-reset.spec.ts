import { expect, test } from '@playwright/test';
import { linkFromEmail, signIn, state } from './support.ts';

test('a user resets a forgotten password from the email link (Q14)', async ({ page }) => {
  const { resetUser } = state();
  const newPassword = 'granite-harbor-e2e';

  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page.getByRole('heading', { name: 'Forgot password' })).toBeVisible();
  await page.getByLabel('Email').fill(resetUser.email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If this email has an account');

  const link = await linkFromEmail(resetUser.email, '/password-reset/');
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await page.getByLabel('New password').fill(newPassword);
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('status')).toContainText('Your password was changed');

  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await page.getByLabel('New password').fill('another-good-e2e-pass');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('alert')).toContainText('invalid or has expired');

  await page.goto('/login');
  await page.getByLabel('Email').fill(resetUser.email);
  await page.getByLabel('Password').fill(resetUser.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect email or password');

  await signIn(page, resetUser.email, newPassword);
  await expect(page.getByText('You are not a member of any organization yet.')).toBeVisible();
});
