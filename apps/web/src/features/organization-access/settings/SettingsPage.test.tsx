// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionData } from '../../../app/session-context.tsx';
import { ApiError, type ApiClient } from '../../../shared/api/client.ts';
import { initI18n } from '../../../i18n/index.ts';
import { SettingsPage } from './SettingsPage.tsx';

// Q16: 16:30 UTC is 23:30 in Asia/Ho_Chi_Minh and 17:30 in Europe/London.
const NOW = new Date('2026-09-15T16:30:00.000Z');

function fakeApi(initial: SessionData['user'], options: { saveNeverCompletes?: boolean; saveFails?: boolean } = {}) {
  let user = initial;
  const session = (): SessionData => ({ user, memberships: [], activeOrganizationId: null });
  const patch = vi.fn((_path: string, body: Partial<SessionData['user']>) => {
    if (options.saveNeverCompletes) return new Promise<SessionData>(() => undefined);
    if (options.saveFails) return Promise.reject(new ApiError(500, 'INTERNAL_ERROR'));
    user = { ...user, ...body };
    return Promise.resolve(session());
  });
  const api = {
    get: vi.fn(() => Promise.resolve(session())),
    post: vi.fn(),
    put: vi.fn(),
    patch,
    del: vi.fn(),
  } as unknown as ApiClient;
  return { api, patch };
}

function renderSettings(api: ApiClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider api={api}>
        <SettingsPage now={NOW} />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await initI18n('vi');
});

afterEach(async () => {
  cleanup();
  await i18next.changeLanguage('vi');
});

describe('SettingsPage (FR-029, FR-030, T116)', () => {
  it('switches labels to English immediately and saves the choice with PATCH /me', async () => {
    // The save never completes: labels must switch without waiting for the server.
    const { api, patch } = fakeApi(
      { id: 'u1', email: 'a@acme.test', locale: 'vi', timeZone: 'Asia/Ho_Chi_Minh' },
      { saveNeverCompletes: true },
    );
    renderSettings(api);
    expect(await screen.findByRole('heading', { name: 'Cài đặt' })).toBeTruthy();

    act(() => {
      fireEvent.change(screen.getByLabelText('Ngôn ngữ'), { target: { value: 'en' } });
    });

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByLabelText('Language')).toBeTruthy();
    expect(patch).toHaveBeenCalledWith('/me', { locale: 'en' });
  });

  it('shows times in the chosen time zone and saves it with PATCH /me', async () => {
    const { api, patch } = fakeApi({ id: 'u1', email: 'a@acme.test', locale: 'en', timeZone: 'Asia/Ho_Chi_Minh' });
    await i18next.changeLanguage('en');
    renderSettings(api);
    expect(await screen.findByText(/23:30 09\/15\/2026/)).toBeTruthy();

    act(() => {
      fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'Europe/London' } });
    });

    expect(await screen.findByText(/17:30 09\/15\/2026/)).toBeTruthy();
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/me', { timeZone: 'Europe/London' }));
  });

  it('applies the language saved on the account when the session loads', async () => {
    const { api } = fakeApi({ id: 'u1', email: 'a@acme.test', locale: 'en', timeZone: 'UTC' });
    renderSettings(api);
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
  });

  it('goes back to the saved language and time zone and shows the error when saving fails (code review)', async () => {
    const { api } = fakeApi(
      { id: 'u1', email: 'a@acme.test', locale: 'vi', timeZone: 'Asia/Ho_Chi_Minh' },
      { saveFails: true },
    );
    renderSettings(api);
    expect(await screen.findByRole('heading', { name: 'Cài đặt' })).toBeTruthy();

    act(() => {
      fireEvent.change(screen.getByLabelText('Ngôn ngữ'), { target: { value: 'en' } });
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    await waitFor(() => expect(i18next.language).toBe('vi'));
    expect(await screen.findByRole('heading', { name: 'Cài đặt' })).toBeTruthy();

    act(() => {
      fireEvent.change(screen.getByLabelText('Múi giờ'), { target: { value: 'Europe/London' } });
    });
    await waitFor(() => expect(screen.getByLabelText<HTMLSelectElement>('Múi giờ').value).toBe('Asia/Ho_Chi_Minh'));
    expect(screen.getByText(/23:30 15\/09\/2026/)).toBeTruthy();
  });
});
