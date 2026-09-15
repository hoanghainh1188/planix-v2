import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../../app/session-context.tsx';
import { formatDateTime } from '../../../shared/time/format-date-time.ts';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';

interface OrganizationItem {
  readonly id: string;
  readonly name: string;
  readonly status: 'active' | 'suspended';
  readonly createdAt: string;
  readonly activeAdminCount: number;
}

/** Platform Operator console: create organizations and (re-)invite their first admin (FR-004). */
export function PlatformOrganizationsPage() {
  const { t, i18n } = useTranslation();
  const { api, session } = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [firstAdminEmail, setFirstAdminEmail] = useState('');

  const organizations = useQuery({
    queryKey: ['platform', 'organizations'],
    queryFn: () => api.get<{ items: OrganizationItem[] }>('/platform/organizations'),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => api.post('/platform/organizations', { name, firstAdminEmail }),
    onSuccess: async () => {
      setName('');
      setFirstAdminEmail('');
      await queryClient.invalidateQueries({ queryKey: ['platform', 'organizations'] });
    },
  });

  const resend = useMutation({
    mutationFn: (input: { organizationId: string; email: string }) =>
      api.post(`/platform/organizations/${input.organizationId}/admin-invitations`, { email: input.email }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  const timeZone = session?.user.timeZone ?? 'Asia/Ho_Chi_Minh';
  const locale = i18n.language === 'en' ? 'en' : 'vi';

  return (
    <section aria-labelledby="platform-heading">
      <h1 id="platform-heading">{t('platform.title')}</h1>
      <ErrorMessage error={organizations.error} />
      <form className="panel" onSubmit={submit} noValidate>
        <h2>{t('platform.createTitle')}</h2>
        <ErrorMessage error={create.error} />
        <label className="field">
          {t('platform.organizationName')}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
        </label>
        <label className="field">
          {t('platform.firstAdminEmail')}
          <input type="email" value={firstAdminEmail} onChange={(e) => setFirstAdminEmail(e.target.value)} required />
        </label>
        <button className="button" type="submit" disabled={create.isPending}>
          {t('platform.create')}
        </button>
      </form>
      {organizations.data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('platform.organizationName')}</th>
              <th>{t('platform.status')}</th>
              <th>{t('platform.createdAt')}</th>
              <th>{t('platform.activeAdmins')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {organizations.data.items.map((org) => (
              <tr key={org.id}>
                <td>{org.name}</td>
                <td>{t(`platform.statuses.${org.status}`)}</td>
                <td>{formatDateTime(org.createdAt, { timeZone, locale })}</td>
                <td>{org.activeAdminCount}</td>
                <td>
                  {org.activeAdminCount === 0 && (
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        const email = window.prompt(t('platform.firstAdminEmail'));
                        if (email) resend.mutate({ organizationId: org.id, email });
                      }}
                    >
                      {t('platform.resendInvitation')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ErrorMessage error={resend.error} />
    </section>
  );
}
