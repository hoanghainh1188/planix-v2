// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../shared/api/client.ts';
import { initI18n } from '../i18n/index.ts';
import { SessionProvider, useSession, type SessionData } from './session-context.tsx';

let current: SessionData | null = null;
let refresh: () => Promise<unknown> = () => Promise.resolve();

/** Hands the provider's refresh() to the test without assigning outer variables during render. */
function Probe({ expose }: { expose: (refresh: () => Promise<unknown>) => void }) {
  const session = useSession();
  useEffect(() => expose(session.refresh), [session.refresh, expose]);
  return null;
}

const signedIn = (id: string, locale: 'vi' | 'en'): SessionData => ({
  user: { id, email: `${id}@acme.test`, locale, timeZone: 'UTC' },
  memberships: [],
  activeOrganizationId: null,
});

beforeEach(async () => {
  await initI18n('vi');
});

afterEach(async () => {
  cleanup();
  await i18next.changeLanguage('vi');
});

describe('the language saved on the account (research R9, code review Phase 10)', () => {
  it('applies the next user saved language even when it equals the previous user saved language', async () => {
    const { ApiError } = await import('../shared/api/client.ts');
    const api = {
      get: vi.fn(() =>
        current === null ? Promise.reject(new ApiError(401, 'AUTH_REQUIRED')) : Promise.resolve(current),
      ),
    } as unknown as ApiClient;
    current = signedIn('user-a', 'en');
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SessionProvider api={api}>
          <Probe expose={(fn) => (refresh = fn)} />
        </SessionProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(i18next.language).toBe('en'));

    // User A picks Vietnamese on the settings page, then signs out before the choice is saved.
    await act(() => i18next.changeLanguage('vi'));
    current = null;
    await act(() => refresh());

    // User B signs in on the same tab; their saved language is English.
    current = signedIn('user-b', 'en');
    await act(() => refresh());
    await waitFor(() => expect(i18next.language).toBe('en'));
  });
});
