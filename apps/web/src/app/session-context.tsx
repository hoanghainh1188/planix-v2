import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
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
  return (
    <SessionContext.Provider
      value={{ api, session: query.data ?? null, loading: query.isPending, refresh: query.refetch }}
    >
      {children}
    </SessionContext.Provider>
  );
}

/** System roles held in the active organization (used only to shape the UI; the API enforces permissions). */
export function useActiveRoles(): ReadonlySet<string> {
  const { session } = useSession();
  const membership = session?.memberships.find(
    (m) => m.organizationId === session.activeOrganizationId && m.status === 'active',
  );
  return new Set(membership?.roles ?? []);
}

export function useSession(): SessionState {
  const state = useContext(SessionContext);
  if (state === undefined) throw new Error('useSession must be used inside SessionProvider');
  return state;
}
