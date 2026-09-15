import { expect, test } from '@playwright/test';
import { seedMember, seedOrganizationWithAdmin, seedProject, signIn, type SeededMember } from './support.ts';

let pm: SeededMember;
let colleague: SeededMember;
let projectId: string;

test.describe.serial('RACI roles and changing the Accountable (Q6, Q9)', () => {
  test.beforeAll(async () => {
    const organization = await seedOrganizationWithAdmin('Acme');
    pm = await seedMember(organization.organizationId, ['projectManager'], 'pm');
    colleague = await seedMember(organization.organizationId, ['member'], 'colleague');
    projectId = await seedProject(organization.organizationId, pm.membershipId, 'Website');
  });

  test('a project manager assigns RACI roles and hands over the Accountable', async ({ page }) => {
    await signIn(page, pm.email, pm.password);
    await page.goto(`/projects/${projectId}/members`);
    await expect(page.getByText(`Accountable: ${pm.email}`)).toBeVisible();

    await page.getByLabel('Organization member').selectOption({ label: colleague.email });
    await page.getByRole('button', { name: 'Add to project' }).click();
    const colleagueRow = page.getByRole('row').filter({ hasText: colleague.email });
    await expect(colleagueRow).toBeVisible();

    await page.getByRole('button', { name: `Edit RACI roles for ${colleague.email}` }).click();
    const editor = page.getByRole('group', { name: `RACI roles for ${colleague.email}` });
    await expect(editor.getByLabel('Accountable')).toHaveCount(0);
    await editor.getByLabel('Responsible').check();
    await editor.getByLabel('Consulted').check();
    await page.getByRole('button', { name: 'Save RACI roles' }).click();
    await expect(colleagueRow).toContainText('Responsible, Consulted');

    // A real modal: focus moves inside, the page behind is inert, Esc cancels without changing anything.
    await page.getByRole('button', { name: 'Change Accountable' }).click();
    await expect(page.getByRole('dialog', { name: 'Change Accountable' }).getByLabel('New Accountable')).toBeFocused();
    // `:modal` means showModal(): the browser makes everything outside the dialog inert.
    await expect(page.locator('dialog:modal')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Change Accountable' })).toHaveCount(0);
    await expect(page.getByText(`Accountable: ${pm.email}`)).toBeVisible();

    await page.getByRole('button', { name: 'Change Accountable' }).click();
    const dialog = page.getByRole('dialog', { name: 'Change Accountable' });
    await dialog.getByLabel('New Accountable').selectOption({ label: colleague.email });
    await dialog.getByRole('button', { name: 'Confirm change' }).click();
    await expect(page.getByText(`Accountable: ${colleague.email}`)).toBeVisible();
    await expect(colleagueRow).toContainText('Accountable');

    await page.getByRole('button', { name: `Remove ${colleague.email} from the project` }).click();
    await expect(page.getByRole('alert')).toContainText('one Accountable');
  });

  test('a member without project.raci.manage does not see RACI actions', async ({ page }) => {
    await signIn(page, colleague.email, colleague.password);
    await page.goto(`/projects/${projectId}/members`);
    await expect(page.getByRole('heading', { name: 'Website', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change Accountable' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Edit RACI roles for / })).toHaveCount(0);
  });
});
