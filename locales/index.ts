import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

// Import translations
import en from './en.json';
import ja from './ja.json';
import zh from './zh.json';

// Set the key-value pairs for the different languages
const translations = {
  en,
  zh,
  ja,
};

// Create and configure i18n instance
const i18n = new I18n(translations);

// Set the locale once at the beginning
const deviceLanguage = getLocales()[0].languageCode;
i18n.locale = deviceLanguage ?? 'en';

// When a value is missing from a language it'll fall back to English
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export default i18n; 