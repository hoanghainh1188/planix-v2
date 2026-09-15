import { expect, test } from '@playwright/test';
import { seedMember, seedOrganizationWithAdmin, signIn, type SeededMember } from './support.ts';

let pm: SeededMember;
let colleague: SeededMember;

test.describe('projects and project members (Q6, Q9 removal)', () => {
  test.beforeAll(async () => {
    const organization = await seedOrganizationWithAdmin('Acme');
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
});
