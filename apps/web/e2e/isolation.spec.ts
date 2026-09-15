import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { seedMember, seedOrganizationWithAdmin, seedProject, signIn, type SeededAdmin } from './support.ts';

let acme: SeededAdmin;
let beta: SeededAdmin;

/** Calls the API from the signed-in page, exactly as the web app would (cookies + CSRF double submit). */
function callApi(page: Page, method: string, path: string, body?: unknown) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const csrf = document.cookie
        .split('; ')
        .find((c) => c.startsWith('planix_csrf='))
        ?.slice('planix_csrf='.length);
      const response = await fetch(`/api/v1${path}`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(csrf ?? '') },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
    },
    { method, path, body },
  );
}

test.describe('organization isolation in the browser (Q3)', () => {
  test.beforeAll(async () => {
    acme = await seedOrganizationWithAdmin('Acme');
    beta = await seedOrganizationWithAdmin('Beta');
  });

  test('lists show only the active organization', async ({ page }) => {
    await signIn(page, acme.email, acme.password);
    await page.goto('/org/members');
    await expect(page.getByRole('cell', { name: acme.email, exact: true })).toBeVisible();
    await expect(page.getByText(beta.email)).toHaveCount(0);
    await page.goto('/org/invitations');
    await expect(page.getByRole('heading', { name: 'Invitations' })).toBeVisible();
    await expect(page.getByText(beta.email)).toHaveCount(0);
  });

  test("addressing another organization's member answers exactly like an id that does not exist", async ({ page }) => {
    await signIn(page, acme.email, acme.password);
    for (const [method, suffix, body] of [
      ['PUT', '/roles', { roles: ['member'] }],
      ['POST', '/deactivate', undefined],
      ['POST', '/reactivate', undefined],
    ] as const) {
      const aimed = await callApi(page, method, `/org/members/${beta.membershipId}${suffix}`, body);
      const random = await callApi(page, method, `/org/members/${randomUUID()}${suffix}`, body);
      expect(aimed).toEqual({ status: 404, body: { error: { code: 'RESOURCE_NOT_FOUND', params: {} } } });
      expect(aimed).toEqual(random);
    }
  });

  test("opening another organization's project by URL shows the same not-found page as an unknown project (moved from T092)", async ({
    page,
  }) => {
    const acmePm = await seedMember(acme.organizationId, ['projectManager'], 'pm');
    const betaPm = await seedMember(beta.organizationId, ['projectManager'], 'pm');
    const betaProjectId = await seedProject(beta.organizationId, betaPm.membershipId, 'Beta secret project');
    await signIn(page, acmePm.email, acmePm.password);

    await page.goto(`/projects/${betaProjectId}/members`);
    await expect(page.getByText('The page or data you requested was not found.')).toBeVisible();
    const aimed = await page.locator('main').innerText();
    expect(aimed).not.toContain('Beta secret project');
    expect(aimed).not.toContain(betaPm.email);

    await page.goto(`/projects/${randomUUID()}/members`);
    await expect(page.getByText('The page or data you requested was not found.')).toBeVisible();
    expect(await page.locator('main').innerText()).toBe(aimed);
  });
});
