import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ASSIGNABLE_RACI_ROLES,
  type AssignableRaciRole,
} from '@planix/core/features/organization-access/raci-invariants.ts';
import type { ProjectMemberView } from '@planix/core/features/organization-access/schemas/projects.ts';
import { useSession } from '../../../app/session-context.tsx';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';

interface RaciEditorProps {
  readonly projectId: string;
  readonly member: ProjectMemberView;
  readonly onDone: () => Promise<unknown> | void;
  readonly onCancel: () => void;
}

/** Edits responsible/consulted/informed of one project member; Accountable changes only via the transfer (FR-020). */
export function RaciEditor({ projectId, member, onDone, onCancel }: RaciEditorProps) {
  const { t } = useTranslation();
  const { api } = useSession();
  const [roles, setRoles] = useState<ReadonlySet<AssignableRaciRole>>(
    new Set(member.raciRoles.filter((r): r is AssignableRaciRole => r !== 'accountable')),
  );

  const save = useMutation({
    mutationFn: () =>
      api.put(`/projects/${projectId}/members/${member.projectMemberId}/raci`, {
        raciRoles: ASSIGNABLE_RACI_ROLES.filter((role) => roles.has(role)),
      }),
    onSuccess: onDone,
  });

  const toggle = (role: AssignableRaciRole, checked: boolean) => {
    const next = new Set(roles);
    if (checked) next.add(role);
    else next.delete(role);
    setRoles(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <form onSubmit={submit}>
      <fieldset className="role-picker">
        <legend>{t('raciEditor.rolesFor', { email: member.email })}</legend>
        {ASSIGNABLE_RACI_ROLES.map((role) => (
          <label key={role} className="role-option">
            <input type="checkbox" checked={roles.has(role)} onChange={(e) => toggle(role, e.target.checked)} />
            {t(`raci.${role}`)}
          </label>
        ))}
      </fieldset>
      {member.raciRoles.includes('accountable') && <p className="hint">{t('raciEditor.accountableKept')}</p>}
      <ErrorMessage error={save.error} />
      <button className="button" type="submit" disabled={save.isPending}>
        {t('raciEditor.save')}
      </button>{' '}
      <button className="button button-secondary" type="button" onClick={onCancel}>
        {t('common.cancel')}
      </button>
    </form>
  );
}
