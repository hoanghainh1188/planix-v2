import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, createApiClient, type ApiClient } from '../shared/api/client.ts';

export interface SessionMembership {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly status: 'active' | 'deactivated';
  readonly roles: readonly string[];
}

export interface SessionData {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly locale: 'vi' | 'en';
    readonly timeZone: string;
  };
  readonly memberships: readonly SessionMembership[];
  readonly activeOrganizationId: string | null;
}

interface SessionState {
  readonly api: ApiClient;
  readonly session: SessionData | null;
  readonly loading: boolean;
  readonly refresh: () => Promise<unknown>;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ api = createApiClient(), children }: { api?: ApiClient; children: ReactNode }) {
  const query = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      try {
        return await api.get<SessionData>('/auth/session');
      } catch (error) {
        if (error instanceof ApiError && error.code === 'AUTH_REQUIRED') return null;
        throw error;
      }
    },
    retry: false,
  });
  const { i18n } = useTranslation();
  const signedInUser = query.data?.user;
  const savedLocale = signedInUser?.locale;
  // "user:locale" last applied; reset on sign-out so the next user's saved language always applies.
  const applied = useRef<string | undefined>(undefined);
  // The language saved on the account applies when it loads or changes (research R9: stored on app_user) — only
  // then, so a language the user just picked is not reverted while its save is still in flight.
  useEffect(() => {
    if (signedInUser === undefined || savedLocale === undefined) {
      applied.current = undefined;
      return;
    }
    const key = `${signedInUser.id}:${savedLocale}`;
    if (applied.current === key) return;
    applied.current = key;
    if (i18n.language !== savedLocale) void i18n.changeLanguage(savedLocale);
  }, [signedInUser, savedLocale, i18n]);

  return (
    <SessionContext.Provider
      value={{ api, session: query.data ?? null, loading: query.isPending, refresh: query.refetch }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const state = useContext(SessionContext);
  if (state === undefined) throw new Error('useSession must be used inside SessionProvider');
  return state;
}
