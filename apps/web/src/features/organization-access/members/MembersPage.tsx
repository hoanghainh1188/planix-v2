import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SystemRole } from '@planix/core/features/organization-access/roles.ts';
import type { MemberView } from '@planix/core/features/organization-access/schemas/members.ts';
import { useActiveRoles, useSession } from '../../../app/session-context.tsx';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';
import { LoadingStatus } from '../../../shared/ui/LoadingStatus.tsx';
import { RoleCheckboxes, useRoleList } from '../roles/RoleCheckboxes.tsx';

const MEMBERS_KEY = ['org', 'members'];

/** Organization members: roles, deactivation and reactivation (US3, FR-012, FR-014, FR-015). */
export function MembersPage() {
  const { t } = useTranslation();
  const { api } = useSession();
  const isAdmin = useActiveRoles().has('admin');
  const roleList = useRoleList();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ membershipId: string; roles: ReadonlySet<SystemRole> } | null>(null);

  const members = useQuery({
    queryKey: MEMBERS_KEY,
    queryFn: () => api.get<{ items: MemberView[] }>('/org/members'),
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });

  const saveRoles = useMutation({
    mutationFn: (input: { membershipId: string; roles: readonly SystemRole[] }) =>
      api.put<MemberView>(`/org/members/${input.membershipId}/roles`, { roles: input.roles }),
    onSuccess: async () => {
      setEditing(null);
      await refresh();
    },
  });

  const changeStatus = useMutation({
    mutationFn: (input: { membershipId: string; to: 'deactivate' | 'reactivate' }) =>
      api.post<MemberView>(`/org/members/${input.membershipId}/${input.to}`),
    onSuccess: refresh,
  });

  return (
    <section aria-labelledby="members-heading">
      <h1 id="members-heading">{t('members.title')}</h1>
      <ErrorMessage error={members.error ?? saveRoles.error ?? changeStatus.error} />
      {members.isPending && <LoadingStatus />}
      {members.data?.items.length === 0 && <p className="hint">{t('members.empty')}</p>}
      {members.data && members.data.items.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('members.email')}</th>
              <th>{t('members.status')}</th>
              <th>{t('members.roles')}</th>
              {isAdmin && <th>{t('members.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {members.data.items.map((member) => (
              <tr key={member.membershipId}>
                <td>{member.email}</td>
                <td>{t(`members.statuses.${member.status}`)}</td>
                <td>
                  {editing?.membershipId === member.membershipId ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        saveRoles.mutate({ membershipId: member.membershipId, roles: [...editing.roles] });
                      }}
                    >
                      <RoleCheckboxes
                        legend={t('members.rolesFor', { email: member.email })}
                        value={editing.roles}
                        onChange={(roles) => setEditing({ membershipId: member.membershipId, roles })}
                      />
                      <button className="button" type="submit" disabled={saveRoles.isPending}>
                        {t('members.saveRoles')}
                      </button>{' '}
                      <button className="button button-secondary" type="button" onClick={() => setEditing(null)}>
                        {t('common.cancel')}
                      </button>
                    </form>
                  ) : (
                    roleList(member.roles)
                  )}
                </td>
                {isAdmin && (
                  <td className="row-actions">
                    {member.status === 'active' && editing?.membershipId !== member.membershipId && (
                      <button
                        className="button button-secondary"
                        type="button"
                        aria-label={t('members.editRolesFor', { email: member.email })}
                        onClick={() =>
                          setEditing({
                            membershipId: member.membershipId,
                            roles: new Set(member.roles as SystemRole[]),
                          })
                        }
                      >
                        {t('members.editRoles')}
                      </button>
                    )}
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={changeStatus.isPending}
                      aria-label={t(member.status === 'active' ? 'members.deactivateFor' : 'members.reactivateFor', {
                        email: member.email,
                      })}
                      onClick={() =>
                        changeStatus.mutate({
                          membershipId: member.membershipId,
                          to: member.status === 'active' ? 'deactivate' : 'reactivate',
                        })
                      }
                    >
                      {t(member.status === 'active' ? 'members.deactivate' : 'members.reactivate')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
