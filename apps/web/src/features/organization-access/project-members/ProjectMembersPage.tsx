import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import type { MemberView } from '@planix/core/features/organization-access/schemas/members.ts';
import type { ProjectDetail, ProjectMemberView } from '@planix/core/features/organization-access/schemas/projects.ts';
import { useSession } from '../../../app/session-context.tsx';
import { ApiError } from '../../../shared/api/client.ts';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';
import { LoadingStatus } from '../../../shared/ui/LoadingStatus.tsx';

/** One project: its Accountable and members; adding and removing organization members (US4, FR-019, FR-020). */
export function ProjectMembersPage() {
  const { projectId = '' } = useParams();
  const { t } = useTranslation();
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [membershipId, setMembershipId] = useState('');
  const membersKey = ['projects', projectId, 'members'];

  const project = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => api.get<ProjectDetail>(`/projects/${projectId}`),
    retry: false,
  });
  const members = useQuery({
    queryKey: membersKey,
    queryFn: () => api.get<{ items: ProjectMemberView[] }>(`/projects/${projectId}/members`),
    enabled: project.isSuccess,
    retry: false,
  });
  const organizationMembers = useQuery({
    queryKey: ['org', 'members', 'active'],
    queryFn: () => api.get<{ items: MemberView[] }>('/org/members?status=active'),
    enabled: project.isSuccess,
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['projects', projectId] });

  const add = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/members`, { membershipId }),
    onSuccess: async () => {
      setMembershipId('');
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (projectMemberId: string) => api.del(`/projects/${projectId}/members/${projectMemberId}`),
    onSuccess: refresh,
  });

  if (project.isPending) return <LoadingStatus />;
  if (project.error instanceof ApiError && project.error.code === 'RESOURCE_NOT_FOUND') {
    // Same page for another organization's project and one that does not exist (FR-003).
    return <p>{t('common.notFound')}</p>;
  }
  if (project.error || !project.data) return <ErrorMessage error={project.error} />;

  const current = new Set(members.data?.items.map((m) => m.membershipId) ?? []);
  const candidates = organizationMembers.data?.items.filter((m) => !current.has(m.membershipId)) ?? [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (membershipId !== '') add.mutate();
  };

  return (
    <section aria-labelledby="project-heading">
      <h1 id="project-heading">{project.data.project.name}</h1>
      {project.data.project.description && <p>{project.data.project.description}</p>}
      <p className="hint">{t('projectMembers.accountable', { email: project.data.accountable.email })}</p>
      <h2>{t('projectMembers.title')}</h2>
      <ErrorMessage error={members.error ?? remove.error} />
      <form className="inline-form" onSubmit={submit}>
        <label className="field">
          {t('projectMembers.organizationMember')}
          <select value={membershipId} onChange={(e) => setMembershipId(e.target.value)}>
            <option value="">{t('projectMembers.choose')}</option>
            {candidates.map((m) => (
              <option key={m.membershipId} value={m.membershipId}>
                {m.email}
              </option>
            ))}
          </select>
        </label>
        <button className="button" type="submit" disabled={add.isPending || membershipId === ''}>
          {t('projectMembers.add')}
        </button>
        <ErrorMessage error={add.error} />
      </form>
      {members.isPending && <LoadingStatus />}
      {members.data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('projectMembers.email')}</th>
              <th>{t('projectMembers.raciRoles')}</th>
              <th>{t('members.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {members.data.items.map((member) => (
              <tr key={member.projectMemberId}>
                <td>{member.email}</td>
                <td>{member.raciRoles.map((role) => t(`raci.${role}`)).join(', ')}</td>
                <td>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={remove.isPending}
                    aria-label={t('projectMembers.removeFor', { email: member.email })}
                    onClick={() => remove.mutate(member.projectMemberId)}
                  >
                    {t('projectMembers.remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
