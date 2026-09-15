import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { SessionPayload } from '@planix/core/features/organization-access/schemas/auth.ts';
import { useSession } from '../../../app/session-context.tsx';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';

interface OrganizationSwitcherProps {
  /** Rendered as a full-page chooser when no organization is active yet. */
  readonly variant?: 'header' | 'page';
}

/** Chooses the active organization; clears every cached query so no data from the previous tenant is shown. */
export function OrganizationSwitcher({ variant = 'header' }: OrganizationSwitcherProps) {
  const { t } = useTranslation();
  const { api, session, refresh } = useSession();
  const queryClient = useQueryClient();

  const change = useMutation({
    mutationFn: (organizationId: string) =>
      api.put<SessionPayload>('/auth/session/active-organization', { organizationId }),
    onSuccess: async () => {
      queryClient.clear();
      await refresh();
    },
  });

  const active = session?.memberships.filter((m) => m.status === 'active') ?? [];
  if (session === null || active.length === 0) return variant === 'page' ? <p>{t('organization.none')}</p> : null;

  return (
    <div className={variant === 'page' ? 'panel' : undefined}>
      {variant === 'page' && <h1>{t('organization.chooseTitle')}</h1>}
      <label className="field">
        <span className={variant === 'header' ? 'hint' : undefined}>{t('organization.active')}</span>
        <select
          aria-label={t('organization.active')}
          value={session.activeOrganizationId ?? ''}
          onChange={(e) => change.mutate(e.target.value)}
          disabled={change.isPending}
        >
          <option value="" disabled>
            {t('organization.placeholder')}
          </option>
          {active.map((m) => (
            <option key={m.organizationId} value={m.organizationId}>
              {m.organizationName}
            </option>
          ))}
        </select>
      </label>
      <ErrorMessage error={change.error} />
    </div>
  );
}
