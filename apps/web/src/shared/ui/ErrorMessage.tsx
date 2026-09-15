import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.ts';

interface ErrorMessageProps {
  readonly error: unknown;
}

/** Renders an API error by its stable code; the server never sends display text (research R9). */
export function ErrorMessage({ error }: ErrorMessageProps) {
  const { t } = useTranslation();
  if (error === null || error === undefined) return null;
  const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
  const rule = error instanceof ApiError && typeof error.params.rule === 'string' ? error.params.rule : undefined;
  return (
    <p role="alert" className="form-error">
      {t(`errors.${code}`)}
      {rule !== undefined && <> {t(`passwordRules.${rule}`)}</>}
    </p>
  );
}
