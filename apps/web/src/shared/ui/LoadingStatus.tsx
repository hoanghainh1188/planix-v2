import { useTranslation } from 'react-i18next';

/** Announced loading indicator for data that is still on its way. */
export function LoadingStatus() {
  const { t } = useTranslation();
  return (
    <p role="status" className="hint">
      {t('common.loading')}
    </p>
  );
}
