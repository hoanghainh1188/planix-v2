import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import type { SessionPayload } from '@planix/core/features/organization-access/schemas/auth.ts';
import { useSession } from '../../../app/session-context.tsx';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';

export function LoginPage() {
  const { t } = useTranslation();
  const { api, refresh } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => api.post<SessionPayload>('/auth/login', { email, password }),
    onSuccess: async () => {
      await refresh();
      const from = (location.state as { from?: string } | null)?.from;
      await navigate(from ?? '/', { replace: true });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate();
  };

  return (
    <div className="auth-page">
      <form className="panel" onSubmit={submit} noValidate>
        <h1>{t('login.title')}</h1>
        <ErrorMessage error={login.error} />
        <label className="field">
          {t('login.email')}
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          {t('login.password')}
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="button" type="submit" disabled={login.isPending}>
          {t('login.submit')}
        </button>
        <p className="hint">
          <Link className="link" to="/password-reset">
            {t('login.forgotPassword')}
          </Link>
        </p>
      </form>
    </div>
  );
}
