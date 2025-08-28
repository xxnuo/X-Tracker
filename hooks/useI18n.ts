import i18n from '@/locales';
import { getLocales } from 'expo-localization';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export const useI18n = () => {
  const [locale, setLocale] = useState(i18n.locale);

  useEffect(() => {
    // Listen for app state changes (Android language change support)
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        const currentLocale = getLocales()[0].languageCode;
        if (currentLocale && currentLocale !== i18n.locale) {
          i18n.locale = currentLocale;
          setLocale(currentLocale);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  const t = (key: string, params?: Record<string, any>) => {
    return i18n.t(key, params);
  };

  const getCurrentLocale = () => {
    return i18n.locale;
  };

  const setCurrentLocale = (newLocale: string) => {
    i18n.locale = newLocale;
    setLocale(newLocale);
  };

  return {
    t,
    locale,
    getCurrentLocale,
    setCurrentLocale,
  };
}; 