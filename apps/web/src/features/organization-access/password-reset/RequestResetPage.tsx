import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useSession } from '../../../app/session-context.tsx';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';

export function RequestResetPage() {
  const { t } = useTranslation();
  const { api } = useSession();
  const [email, setEmail] = useState('');
  const request = useMutation({ mutationFn: () => api.post<void>('/auth/password-reset/request', { email }) });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    request.mutate();
  };

  return (
    <div className="auth-page">
      <form className="panel" onSubmit={submit} noValidate>
        <h1>{t('passwordReset.requestTitle')}</h1>
        <ErrorMessage error={request.error} />
        {request.isSuccess ? (
          <p role="status">{t('passwordReset.requestSent')}</p>
        ) : (
          <>
            <label className="field">
              {t('login.email')}
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button className="button" type="submit" disabled={request.isPending}>
              {t('passwordReset.requestSubmit')}
            </button>
          </>
        )}
        <p className="hint">
          <Link className="link" to="/login">
            {t('passwordReset.backToLogin')}
          </Link>
        </p>
      </form>
    </div>
  );
}
