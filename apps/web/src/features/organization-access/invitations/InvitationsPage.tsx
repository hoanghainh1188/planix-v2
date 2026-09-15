import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { SystemRole } from '@planix/core/features/organization-access/roles.ts';
import type { InvitationView } from '@planix/core/features/organization-access/schemas/members.ts';
import { useSession } from '../../../app/session-context.tsx';
import { formatDateTime } from '../../../shared/time/format-date-time.ts';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';
import { LoadingStatus } from '../../../shared/ui/LoadingStatus.tsx';
import { RoleCheckboxes, useRoleList } from '../roles/RoleCheckboxes.tsx';

const INVITATIONS_KEY = ['org', 'invitations'];

/** Admin invites people by email with one or more roles, and revokes pending invitations (US3, FR-009). */
export function InvitationsPage() {
  const { t, i18n } = useTranslation();
  const { api, session } = useSession();
  const roleList = useRoleList();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<ReadonlySet<SystemRole>>(new Set(['member']));

  const invitations = useQuery({
    queryKey: INVITATIONS_KEY,
    queryFn: () => api.get<{ items: InvitationView[] }>('/org/invitations'),
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY });

  const invite = useMutation({
    mutationFn: () => api.post('/org/invitations', { email, roles: [...roles] }),
    onSuccess: async () => {
      setEmail('');
      setRoles(new Set(['member']));
      await refresh();
    },
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) => api.del(`/org/invitations/${invitationId}`),
    onSuccess: refresh,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    invite.mutate();
  };

  const timeZone = session?.user.timeZone ?? 'Asia/Ho_Chi_Minh';
  const locale = i18n.language === 'en' ? 'en' : 'vi';

  return (
    <section aria-labelledby="invitations-heading">
      <h1 id="invitations-heading">{t('invitations.title')}</h1>
      <ErrorMessage error={invitations.error ?? revoke.error} />
      <form className="panel" onSubmit={submit} noValidate>
        <h2>{t('invitations.inviteTitle')}</h2>
        <ErrorMessage error={invite.error} />
        <label className="field">
          {t('invitations.email')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <RoleCheckboxes legend={t('invitations.roles')} value={roles} onChange={setRoles} />
        <button className="button" type="submit" disabled={invite.isPending}>
          {t('invitations.send')}
        </button>
      </form>
      {invitations.isPending && <LoadingStatus />}
      {invitations.data?.items.length === 0 && <p className="hint">{t('invitations.empty')}</p>}
      {invitations.data && invitations.data.items.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('invitations.email')}</th>
              <th>{t('invitations.roles')}</th>
              <th>{t('invitations.status')}</th>
              <th>{t('invitations.expiresAt')}</th>
              <th>{t('members.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {invitations.data.items.map((invitation) => (
              <tr key={invitation.id}>
                <td>{invitation.email}</td>
                <td>{roleList(invitation.roles)}</td>
                <td>{t(`invitations.statuses.${invitation.status}`)}</td>
                <td>{formatDateTime(invitation.expiresAt, { timeZone, locale })}</td>
                <td>
                  {invitation.status === 'pending' && (
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={revoke.isPending}
                      aria-label={t('invitations.revokeFor', { email: invitation.email })}
                      onClick={() => revoke.mutate(invitation.id)}
                    >
                      {t('invitations.revoke')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
