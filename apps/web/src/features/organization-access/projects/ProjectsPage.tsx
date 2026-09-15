import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ProjectView } from '@planix/core/features/organization-access/schemas/projects.ts';
import { useSession } from '../../../app/session-context.tsx';
import { useCan } from '../../../shared/authorization/useCan.ts';
import { formatDateTime } from '../../../shared/time/format-date-time.ts';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';
import { LoadingStatus } from '../../../shared/ui/LoadingStatus.tsx';

const PROJECTS_KEY = ['projects'];

/** Projects the caller is a member of, and creating a project (US4, FR-016, FR-018). */
export function ProjectsPage() {
  const { t, i18n } = useTranslation();
  const { api, session } = useSession();
  const queryClient = useQueryClient();
  const canCreate = useCan('project.create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const projects = useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: () => api.get<{ items: ProjectView[] }>('/projects'),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => api.post('/projects', { name, description: description.trim() === '' ? null : description }),
    onSuccess: async () => {
      setName('');
      setDescription('');
      await queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  const timeZone = session?.user.timeZone ?? 'Asia/Ho_Chi_Minh';
  const locale = i18n.language === 'en' ? 'en' : 'vi';

  return (
    <section aria-labelledby="projects-heading">
      <h1 id="projects-heading">{t('projects.title')}</h1>
      <ErrorMessage error={projects.error} />
      {canCreate && (
        <form className="panel" onSubmit={submit} noValidate>
          <h2>{t('projects.createTitle')}</h2>
          <ErrorMessage error={create.error} />
          <label className="field">
            {t('projects.name')}
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
          </label>
          <label className="field">
            {t('projects.description')}
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} rows={3} />
          </label>
          <button className="button" type="submit" disabled={create.isPending}>
            {t('projects.create')}
          </button>
        </form>
      )}
      {projects.isPending && <LoadingStatus />}
      {projects.data?.items.length === 0 && <p className="hint">{t('projects.empty')}</p>}
      {projects.data && projects.data.items.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('projects.name')}</th>
              <th>{t('projects.createdAt')}</th>
            </tr>
          </thead>
          <tbody>
            {projects.data.items.map((project) => (
              <tr key={project.id}>
                <td>
                  <Link className="link" to={`/projects/${project.id}/members`}>
                    {project.name}
                  </Link>
                </td>
                <td>{formatDateTime(project.createdAt, { timeZone, locale })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
