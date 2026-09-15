import { expect, test, type Page } from '@playwright/test';
import { linkFromEmail, seedOrganizationWithAdmin, signIn, type SeededAdmin } from './support.ts';

const memberPassword = 'granite-harbor-e2e';
let admin: SeededAdmin;
let memberEmail: string;

const rowOf = (page: Page, email: string) => page.getByRole('row').filter({ hasText: email });

test.describe.serial('members and system roles (Q4, Q5, Q10)', () => {
  test.beforeAll(async () => {
    admin = await seedOrganizationWithAdmin('Acme');
    memberEmail = `pm.${Date.now()}@acme-e2e.test`;
  });

  test('admin invites a person who accepts, then gets several roles (Q4)', async ({ page, browser }) => {
    await signIn(page, admin.email, admin.password);
    await page.getByRole('link', { name: 'Invitations' }).click();
    await expect(page.getByRole('heading', { name: 'Invitations' })).toBeVisible();
    await page.getByLabel('Email').fill(memberEmail);
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(rowOf(page, memberEmail)).toContainText('Pending');

    const invitee = await (await browser.newContext()).newPage();
    await invitee.goto(await linkFromEmail(memberEmail, '/invitations/'));
    await invitee.getByLabel('Choose a password for your new account').fill(memberPassword);
    await invitee.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(invitee.getByRole('heading', { name: admin.organizationName, exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Members' }).click();
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
    await page.getByRole('button', { name: `Edit roles for ${memberEmail}` }).click();
    const roles = page.getByRole('group', { name: `Roles for ${memberEmail}` });
    await roles.getByLabel('Member').uncheck();
    await roles.getByLabel('Project manager').check();
    await roles.getByLabel('Finance').check();
    await page.getByRole('button', { name: 'Save roles' }).click();
    await expect(rowOf(page, memberEmail)).toContainText('Project manager, Finance');
  });

  test('the last admin cannot remove their own admin role or deactivate themselves (Q5)', async ({ page }) => {
    await signIn(page, admin.email, admin.password);
    await page.goto('/org/members');
    await page.getByRole('button', { name: `Edit roles for ${admin.email}` }).click();
    const roles = page.getByRole('group', { name: `Roles for ${admin.email}` });
    await roles.getByLabel('Admin').uncheck();
    await roles.getByLabel('Member').check();
    await page.getByRole('button', { name: 'Save roles' }).click();
    await expect(page.getByRole('alert')).toContainText('at least one admin');

    await page.goto('/org/members');
    await page.getByRole('button', { name: `Deactivate ${admin.email}` }).click();
    await expect(page.getByRole('alert')).toContainText('at least one admin');
  });

  test('a deactivated member is refused on the next request and comes back as Member only (Q10)', async ({
    page,
    browser,
  }) => {
    const member = await (await browser.newContext()).newPage();
    await signIn(member, memberEmail, memberPassword);
    await expect(member.getByRole('heading', { name: admin.organizationName, exact: true })).toBeVisible();

    await signIn(page, admin.email, admin.password);
    await page.goto('/org/members');
    await page.getByRole('button', { name: `Deactivate ${memberEmail}` }).click();
    await expect(rowOf(page, memberEmail)).toContainText('Deactivated');

    // The member's very next API request is refused (SC-004)…
    await member.getByRole('link', { name: 'Members' }).click();
    await expect(member.getByRole('alert')).toContainText('has been deactivated');
    // …and after a reload the organization is no longer offered.
    await member.reload();
    await expect(member.getByText('You are not a member of any organization yet.')).toBeVisible();

    await page.getByRole('button', { name: `Reactivate ${memberEmail}` }).click();
    await expect(rowOf(page, memberEmail)).toContainText('Active');
    await expect(rowOf(page, memberEmail)).toContainText('Member');

    await signIn(member, memberEmail, memberPassword);
    await member.goto('/org/members');
    await expect(member.getByRole('heading', { name: 'Members' })).toBeVisible();
    await expect(member.getByRole('alert')).toHaveCount(0);
  });
});
