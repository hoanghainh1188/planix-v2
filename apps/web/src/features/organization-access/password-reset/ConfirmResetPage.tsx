import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useSession } from '../../../app/session-context.tsx';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';

export function ConfirmResetPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const { api } = useSession();
  const [newPassword, setNewPassword] = useState('');
  const confirm = useMutation({
    mutationFn: () => api.post<void>('/auth/password-reset/confirm', { token, newPassword }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    confirm.mutate();
  };

  return (
    <div className="auth-page">
      <form className="panel" onSubmit={submit} noValidate>
        <h1>{t('passwordReset.confirmTitle')}</h1>
        <ErrorMessage error={confirm.error} />
        {confirm.isSuccess ? (
          <p role="status">
            {t('passwordReset.confirmDone')}{' '}
            <Link className="link" to="/login">
              {t('login.submit')}
            </Link>
          </p>
        ) : (
          <>
            <label className="field">
              {t('passwordReset.newPassword')}
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={12}
                required
              />
            </label>
            <p className="hint">{t('passwordRules.hint')}</p>
            <button className="button" type="submit" disabled={confirm.isPending}>
              {t('passwordReset.confirmSubmit')}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
