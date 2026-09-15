import { expect, test, type Page } from '@playwright/test';
import { seedOrganizationWithAdmin, signIn, state, type SeededAdmin } from './support.ts';

let admin: SeededAdmin;

/** Independent of the app's formatter: "HH:mm MM/DD/YYYY" (English) for an instant in an IANA time zone. */
function englishDisplay(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('hour')}:${part('minute')} ${part('month')}/${part('day')}/${part('year')}`;
}

async function expiresAtInDatabase(email: string): Promise<Date> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: state().databaseUrl, max: 1 });
  try {
    const { rows } = await pool.query<{ utc: string }>(
      `SELECT to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS utc
         FROM organization_invitation WHERE email = $1`,
      [email],
    );
    return new Date(rows[0]!.utc);
  } finally {
    await pool.end();
  }
}

async function choose(page: Page, label: RegExp, value: string) {
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/v1/me') && r.request().method() === 'PATCH');
  await page.getByRole('combobox', { name: label }).selectOption(value);
  expect((await saved).ok()).toBe(true);
}

test.describe.serial('language and UTC times (Q16, FR-029, FR-030, SC-007)', () => {
  test.beforeAll(async () => {
    admin = await seedOrganizationWithAdmin('Acme');
  });

  test('the chosen language applies at once, to labels and error messages, and is kept', async ({ page }) => {
    await signIn(page, admin.email, admin.password);
    await page.getByRole('link', { name: 'Settings' }).click();

    await choose(page, /^(Language|Ngôn ngữ)$/, 'vi');
    await expect(page.getByRole('heading', { name: 'Cài đặt', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dự án' })).toBeVisible();
    await page.getByRole('link', { name: 'Lời mời' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill('not-an-email');
    await page.getByRole('button', { name: 'Gửi lời mời' }).click();
    await expect(page.getByRole('alert')).toContainText('Dữ liệu nhập chưa hợp lệ.');

    await page.goto('/settings');
    await choose(page, /^(Language|Ngôn ngữ)$/, 'en');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible();
    await page.getByRole('link', { name: 'Invitations' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill('not-an-email');
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByRole('alert')).toContainText('Some of the information entered is invalid.');
  });

  test('a time stored in UTC is shown in the user time zone, and follows a time zone change', async ({ page }) => {
    const email = `q16.${Date.now()}@acme-e2e.test`;
    await signIn(page, admin.email, admin.password);
    await page.goto('/org/invitations');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('button', { name: 'Send invitation' }).click();
    const row = page.getByRole('row').filter({ hasText: email });
    await expect(row).toBeVisible();

    const expiresAt = await expiresAtInDatabase(email);
    await expect(row).toContainText(englishDisplay(expiresAt, 'Asia/Ho_Chi_Minh'));

    await page.goto('/settings');
    await choose(page, /^(Time zone|Múi giờ)$/, 'Europe/London');
    await page.goto('/org/invitations');
    const londonRow = page.getByRole('row').filter({ hasText: email });
    await expect(londonRow).toContainText(englishDisplay(expiresAt, 'Europe/London'));
    expect(englishDisplay(expiresAt, 'Europe/London')).not.toBe(englishDisplay(expiresAt, 'Asia/Ho_Chi_Minh'));
  });
});
