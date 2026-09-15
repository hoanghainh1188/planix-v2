import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import type { SessionPayload } from '@planix/core/features/organization-access/schemas/auth.ts';
import { useSession } from '../../../app/session-context.tsx';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';

interface InvitationDescription {
  readonly organizationName: string;
  readonly email: string;
  readonly requiresAccountCreation: boolean;
}

export function AcceptInvitationPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const { api, session, refresh } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');

  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.get<InvitationDescription>(`/invitations/${token}`),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.post<SessionPayload>(`/invitations/${token}/accept`, password === '' ? {} : { password }),
    onSuccess: async () => {
      await refresh();
      await navigate('/', { replace: true });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    accept.mutate();
  };

  if (invitation.isPending) return <div className="auth-page">{t('common.loading')}</div>;
  if (invitation.isError) {
    return (
      <div className="auth-page">
        <div className="panel">
          <ErrorMessage error={invitation.error} />
        </div>
      </div>
    );
  }

  const { organizationName, email, requiresAccountCreation } = invitation.data;
  const signedInAsSomeoneElse = session !== null && session.user.email.toLowerCase() !== email.toLowerCase();

  return (
    <div className="auth-page">
      <form className="panel" onSubmit={submit} noValidate>
        <h1>{t('invitation.title', { organizationName })}</h1>
        <p className="hint">{t('invitation.invitedEmail', { email })}</p>
        <ErrorMessage error={accept.error} />
        {requiresAccountCreation ? (
          <>
            <label className="field">
              {t('invitation.choosePassword')}
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                required
              />
            </label>
            <p className="hint">{t('passwordRules.hint')}</p>
          </>
        ) : session === null || signedInAsSomeoneElse ? (
          <p>
            {t('invitation.signInAs', { email })}{' '}
            <Link className="link" to="/login" state={{ from: `/invitations/${token}` }}>
              {t('login.submit')}
            </Link>
          </p>
        ) : null}
        {(requiresAccountCreation || (session !== null && !signedInAsSomeoneElse)) && (
          <button className="button" type="submit" disabled={accept.isPending}>
            {t('invitation.accept')}
          </button>
        )}
      </form>
    </div>
  );
}
