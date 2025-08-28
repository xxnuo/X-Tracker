import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useI18n } from '@/hooks/useI18n';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Switch, View } from 'react-native';

const { width } = Dimensions.get('window');

interface SettingsState {
  isFullScreen: boolean;
  keepAwake: boolean;
  darkMode: 'auto' | 'light' | 'dark';
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useI18n();

  const [settings, setSettings] = useState<SettingsState>({
    isFullScreen: false,
    keepAwake: false,
    darkMode: 'auto',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('appSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);

        // Apply saved settings
        if (parsed.keepAwake) {
          activateKeepAwakeAsync();
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: SettingsState) => {
    try {
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert(t('common.error'), t('settings.failedSaveSettings'));
    }
  };

  const toggleFullScreen = async () => {
    try {
      const newFullScreenState = !settings.isFullScreen;

      if (newFullScreenState) {
        // Enter fullscreen mode
        await ScreenOrientation.unlockAsync();
      } else {
        // Exit fullscreen mode
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }

      const newSettings = { ...settings, isFullScreen: newFullScreenState };
      await saveSettings(newSettings);

    } catch (error) {
      console.error('Error toggling fullscreen:', error);
      Alert.alert(t('common.error'), t('settings.failedToggleFullscreen'));
    }
  };

  const toggleKeepAwake = async () => {
    try {
      const newKeepAwakeState = !settings.keepAwake;

      if (newKeepAwakeState) {
        await activateKeepAwakeAsync();
      } else {
        deactivateKeepAwake();
      }

      const newSettings = { ...settings, keepAwake: newKeepAwakeState };
      await saveSettings(newSettings);

    } catch (error) {
      console.error('Error toggling keep awake:', error);
      Alert.alert(t('common.error'), t('settings.failedToggleKeepAwake'));
    }
  };

  const changeDarkMode = async (mode: 'auto' | 'light' | 'dark') => {
    try {
      const newSettings = { ...settings, darkMode: mode };
      await saveSettings(newSettings);

      // Note: For full dark mode implementation, you would typically need to modify
      // the app's theme provider to respect this setting
      Alert.alert(
        'Dark Mode',
        `Dark mode set to ${mode}. App will use this setting on next restart.`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Error changing dark mode:', error);
      Alert.alert('Error', 'Failed to change dark mode setting');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar hidden={settings.isFullScreen} style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>{t('settings.title')}</ThemedText>
        </View>

        {/* Display Settings */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>{t('settings.display')}</ThemedText>

          {/* Full Screen Setting */}
          <View style={[styles.settingCard, { backgroundColor: colors.background }]}>
            <View style={styles.settingContent}>
              <View style={styles.settingHeader}>
                <MaterialIcons name="fullscreen" size={24} color={colors.tint} />
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingTitle}>{t('settings.fullScreen')}</ThemedText>
                  <ThemedText style={styles.settingDescription}>
                    {t('settings.fullScreenDesc')}
                  </ThemedText>
                </View>
              </View>
              <Switch
                value={settings.isFullScreen}
                onValueChange={toggleFullScreen}
                trackColor={{ false: colors.tabIconDefault, true: colors.tint }}
                thumbColor={settings.isFullScreen ? '#ffffff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Keep Awake Setting */}
          <View style={[styles.settingCard, { backgroundColor: colors.background }]}>
            <View style={styles.settingContent}>
              <View style={styles.settingHeader}>
                <MaterialIcons name="lightbulb" size={24} color={colors.tint} />
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingTitle}>{t('settings.keepAwake')}</ThemedText>
                  <ThemedText style={styles.settingDescription}>
                    {t('settings.keepAwakeDesc')}
                  </ThemedText>
                </View>
              </View>
              <Switch
                value={settings.keepAwake}
                onValueChange={toggleKeepAwake}
                trackColor={{ false: colors.tabIconDefault, true: colors.tint }}
                thumbColor={settings.keepAwake ? '#ffffff' : '#f4f3f4'}
              />
            </View>
          </View>
        </View>

        {/* Appearance Settings */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Appearance</ThemedText>

          {/* Dark Mode Settings */}
          <View style={[styles.settingCard, { backgroundColor: colors.background }]}>
            <View style={styles.settingContent}>
              <View style={styles.settingHeader}>
                <MaterialIcons name="dark-mode" size={24} color={colors.tint} />
                <View style={styles.settingText}>
                  <ThemedText style={styles.settingTitle}>Dark Mode</ThemedText>
                  <ThemedText style={styles.settingDescription}>
                    Choose your preferred theme
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.darkModeOptions}>
              {(['auto', 'light', 'dark'] as const).map((mode) => (
                <View key={mode} style={styles.darkModeOption}>
                  <ThemedText
                    style={[
                      styles.darkModeText,
                      settings.darkMode === mode && { color: colors.tint, fontWeight: 'bold' }
                    ]}
                    onPress={() => changeDarkMode(mode)}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </ThemedText>
                  <Switch
                    value={settings.darkMode === mode}
                    onValueChange={() => changeDarkMode(mode)}
                    trackColor={{ false: colors.tabIconDefault, true: colors.tint }}
                    thumbColor={settings.darkMode === mode ? '#ffffff' : '#f4f3f4'}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Language Settings */}
        <View style={styles.section}>
          <LanguageSelector />
        </View>

        {/* App Information */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>About</ThemedText>

          <View style={[styles.settingCard, { backgroundColor: colors.background }]}>
            <View style={styles.aboutContent}>
              <MaterialIcons name="info" size={24} color={colors.tint} />
              <View style={styles.aboutText}>
                <ThemedText style={styles.aboutTitle}>X-Tracker</ThemedText>
                <ThemedText style={styles.aboutVersion}>Version 1.0.0</ThemedText>
                <ThemedText style={styles.aboutDescription}>
                  A powerful bike computer app with GPS tracking, speed monitoring, and ride statistics.
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Current Settings Display */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Current Status</ThemedText>

          <View style={[styles.statusCard, { backgroundColor: colors.background }]}>
            <View style={styles.statusRow}>
              <ThemedText style={styles.statusLabel}>Full Screen:</ThemedText>
              <ThemedText style={[styles.statusValue, { color: settings.isFullScreen ? '#4CAF50' : '#FF5722' }]}>
                {settings.isFullScreen ? 'ON' : 'OFF'}
              </ThemedText>
            </View>

            <View style={styles.statusRow}>
              <ThemedText style={styles.statusLabel}>Keep Awake:</ThemedText>
              <ThemedText style={[styles.statusValue, { color: settings.keepAwake ? '#4CAF50' : '#FF5722' }]}>
                {settings.keepAwake ? 'ON' : 'OFF'}
              </ThemedText>
            </View>

            <View style={styles.statusRow}>
              <ThemedText style={styles.statusLabel}>Theme:</ThemedText>
              <ThemedText style={styles.statusValue}>
                {settings.darkMode.charAt(0).toUpperCase() + settings.darkMode.slice(1)}
              </ThemedText>
            </View>

            <View style={styles.statusRow}>
              <ThemedText style={styles.statusLabel}>Current Scheme:</ThemedText>
              <ThemedText style={styles.statusValue}>
                {(colorScheme || 'light').charAt(0).toUpperCase() + (colorScheme || 'light').slice(1)}
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  settingCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  settingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 15,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  darkModeOptions: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  darkModeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  darkModeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  aboutContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aboutText: {
    marginLeft: 15,
    flex: 1,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  aboutVersion: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 8,
  },
  aboutDescription: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
  },
  statusCard: {
    borderRadius: 15,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
  },
}); 