import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useI18n } from '@/hooks/useI18n';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
];

export const LanguageSelector: React.FC = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t, getCurrentLocale, setCurrentLocale } = useI18n();

  const currentLocale = getCurrentLocale();

  const handleLanguageChange = (languageCode: string) => {
    setCurrentLocale(languageCode);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <MaterialIcons name="language" size={24} color={colors.tint} />
        <View style={styles.headerText}>
          <ThemedText style={styles.title}>{t('settings.language')}</ThemedText>
          <ThemedText style={styles.description}>{t('settings.languageDesc')}</ThemedText>
        </View>
      </View>

      <View style={styles.languageOptions}>
        {languages.map((language) => (
          <TouchableOpacity
            key={language.code}
            style={[
              styles.languageOption,
              {
                backgroundColor: currentLocale === language.code 
                  ? colors.tint + '20' 
                  : 'transparent',
                borderColor: currentLocale === language.code 
                  ? colors.tint 
                  : colors.tabIconDefault,
              }
            ]}
            onPress={() => handleLanguageChange(language.code)}
          >
            <View style={styles.languageInfo}>
              <ThemedText 
                style={[
                  styles.languageName,
                  { color: currentLocale === language.code ? colors.tint : colors.text }
                ]}
              >
                {language.nativeName}
              </ThemedText>
              <ThemedText 
                style={[
                  styles.languageEnglishName,
                  { color: currentLocale === language.code ? colors.tint : colors.tabIconDefault }
                ]}
              >
                {language.name}
              </ThemedText>
            </View>
            {currentLocale === language.code && (
              <MaterialIcons name="check" size={20} color={colors.tint} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  description: {
    fontSize: 14,
    opacity: 0.7,
  },
  languageOptions: {
    gap: 8,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  languageEnglishName: {
    fontSize: 14,
    opacity: 0.7,
  },
}); 