import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json' with { type: 'json' };
import vi from './vi.json' with { type: 'json' };

export type Locale = 'vi' | 'en';

/** Server returns error codes only; the web app translates them (research R9). */
export async function initI18n(locale: Locale = 'vi') {
  await i18next.use(initReactI18next).init({
    resources: { vi: { translation: vi }, en: { translation: en } },
    lng: locale,
    fallbackLng: 'vi',
    interpolation: { escapeValue: false },
  });
  return i18next;
}
