import { useMutation } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectMemberView } from '@planix/core/features/organization-access/schemas/projects.ts';
import { useSession } from '../../../app/session-context.tsx';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';

interface ChangeAccountableDialogProps {
  readonly projectId: string;
  readonly members: readonly ProjectMemberView[];
  readonly currentProjectMemberId: string;
  readonly onDone: () => Promise<unknown> | void;
  readonly onCancel: () => void;
}

/** Replaces the project's single Accountable in one step (decision single-accountable-per-project, Q9). */
export function ChangeAccountableDialog({
  projectId,
  members,
  currentProjectMemberId,
  onDone,
  onCancel,
}: ChangeAccountableDialogProps) {
  const { t } = useTranslation();
  const { api } = useSession();
  const titleId = useId();
  const [projectMemberId, setProjectMemberId] = useState('');
  const candidates = members.filter((m) => m.projectMemberId !== currentProjectMemberId);

  const change = useMutation({
    mutationFn: () => api.put(`/projects/${projectId}/accountable`, { projectMemberId }),
    onSuccess: onDone,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (projectMemberId !== '') change.mutate();
  };

  return (
    <dialog open className="panel dialog" aria-labelledby={titleId}>
      <form onSubmit={submit}>
        <h2 id={titleId}>{t('changeAccountable.title')}</h2>
        <p className="hint">{t('changeAccountable.explanation')}</p>
        {candidates.length === 0 ? (
          <p className="hint">{t('changeAccountable.noCandidates')}</p>
        ) : (
          <label className="field">
            {t('changeAccountable.newAccountable')}
            <select value={projectMemberId} onChange={(e) => setProjectMemberId(e.target.value)}>
              <option value="">{t('projectMembers.choose')}</option>
              {candidates.map((m) => (
                <option key={m.projectMemberId} value={m.projectMemberId}>
                  {m.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <ErrorMessage error={change.error} />
        <button className="button" type="submit" disabled={change.isPending || projectMemberId === ''}>
          {t('changeAccountable.confirm')}
        </button>{' '}
        <button className="button button-secondary" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </form>
    </dialog>
  );
}
