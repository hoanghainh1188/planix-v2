import { expect, test } from '@playwright/test';
import { seedMember, seedOrganizationWithAdmin, seedProject, signIn, type SeededMember } from './support.ts';

let pm: SeededMember;
let colleague: SeededMember;
let organizationId: string;

test.describe('projects and project members (Q6, Q9 removal)', () => {
  test.beforeAll(async () => {
    const organization = await seedOrganizationWithAdmin('Acme');
    organizationId = organization.organizationId;
    pm = await seedMember(organization.organizationId, ['projectManager'], 'pm');
    colleague = await seedMember(organization.organizationId, ['member'], 'colleague');
  });

  test('a project manager creates a project, becomes its Accountable, adds and removes a member', async ({ page }) => {
    await signIn(page, pm.email, pm.password);
    await page.getByRole('link', { name: 'Projects' }).click();
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
    await expect(page.getByText('No projects yet.')).toBeVisible();

    await page.getByLabel('Project name').fill('Website');
    await page.getByRole('button', { name: 'Create project' }).click();
    await page.getByRole('link', { name: 'Website' }).click();

    await expect(page.getByRole('heading', { name: 'Website', exact: true })).toBeVisible();
    await expect(page.getByText(`Accountable: ${pm.email}`)).toBeVisible();

    await page.getByLabel('Organization member').selectOption({ label: colleague.email });
    await page.getByRole('button', { name: 'Add to project' }).click();
    await expect(page.getByRole('row').filter({ hasText: colleague.email })).toBeVisible();

    await page.getByRole('button', { name: `Remove ${pm.email} from the project` }).click();
    await expect(page.getByRole('alert')).toContainText('one Accountable');

    await page.getByRole('button', { name: `Remove ${colleague.email} from the project` }).click();
    await expect(page.getByRole('row').filter({ hasText: colleague.email })).toHaveCount(0);
  });

  test('actions the role does not allow are hidden (useCan); the API still decides', async ({ page }) => {
    const member = await seedMember(organizationId, ['member'], 'plain');
    const projectId = await seedProject(organizationId, member.membershipId, 'Member project');
    await signIn(page, member.email, member.password);

    await page.goto('/projects');
    await expect(page.getByRole('link', { name: 'Member project' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create project' })).toHaveCount(0);

    await page.goto(`/projects/${projectId}/members`);
    await expect(page.getByRole('heading', { name: 'Member project', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to project' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Invitations' })).toHaveCount(0);
  });
});
