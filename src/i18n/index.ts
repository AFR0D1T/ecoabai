import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './ru.json';
import kk from './kk.json';
import { STORAGE_KEYS } from '@/config';

export const LANGUAGES = ['ru', 'kk'] as const;
export type Lang = (typeof LANGUAGES)[number];

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.lang);
    if (saved === 'ru' || saved === 'kk') return saved;
  } catch {
    /* localStorage недоступен */
  }
  return 'ru';
}

void i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, kk: { translation: kk } },
  lng: initialLang(),
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEYS.lang, lng);
  } catch {
    /* ignore */
  }
});
document.documentElement.lang = i18n.language;

export function currentLang(): Lang {
  return i18n.language === 'kk' ? 'kk' : 'ru';
}

export default i18n;
