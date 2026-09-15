import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../../app/session-context.tsx';
import { formatDateTime } from '../../../shared/time/format-date-time.ts';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.tsx';
import { LoadingStatus } from '../../../shared/ui/LoadingStatus.tsx';

type Locale = 'vi' | 'en';
const LOCALES: readonly Locale[] = ['vi', 'en'];

interface SettingsPageProps {
  /** The instant shown as an example of the chosen time zone; injectable for tests. */
  readonly now?: Date;
}

/** Language and time zone of the signed-in user (US8, FR-029, FR-030). Stored times stay UTC; only display changes. */
export function SettingsPage({ now }: SettingsPageProps) {
  const { t, i18n } = useTranslation();
  const { api, session, refresh } = useSession();
  const [pendingTimeZone, setPendingTimeZone] = useState<string | undefined>();
  const [shownAt] = useState(() => now ?? new Date());
  const timeZones = useMemo(() => Intl.supportedValuesOf('timeZone'), []);

  const save = useMutation({
    mutationFn: (body: { locale?: Locale; timeZone?: string }) => api.patch('/me', body),
    onSuccess: () => refresh(),
  });

  if (session === null) return <LoadingStatus />;

  const timeZone = pendingTimeZone ?? session.user.timeZone;
  const locale: Locale = i18n.language === 'en' ? 'en' : 'vi';
  const zones = timeZones.includes(timeZone) ? timeZones : [timeZone, ...timeZones];

  return (
    <section aria-labelledby="settings-heading" className="panel">
      <h1 id="settings-heading">{t('settings.title')}</h1>
      <ErrorMessage error={save.error} />
      <label className="field">
        {t('settings.language')}
        <select
          value={locale}
          onChange={(event) => {
            const next = event.target.value as Locale;
            // Labels change at once; the choice is saved on the account for the next sessions.
            // If saving fails, go back to the previous language so the page matches what is stored.
            void i18n.changeLanguage(next);
            save.mutate({ locale: next }, { onError: () => void i18n.changeLanguage(locale) });
          }}
        >
          {LOCALES.map((value) => (
            <option key={value} value={value}>
              {t(`settings.languages.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {t('settings.timeZone')}
        <select
          value={timeZone}
          onChange={(event) => {
            setPendingTimeZone(event.target.value);
            save.mutate({ timeZone: event.target.value }, { onError: () => setPendingTimeZone(undefined) });
          }}
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>
      <p className="hint" role="status">
        {t('settings.timeExample', { time: formatDateTime(shownAt.toISOString(), { timeZone, locale }) })}
      </p>
    </section>
  );
}
