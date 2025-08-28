import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useI18n } from '@/hooks/useI18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';

const { width, height } = Dimensions.get('window');

interface LocationData {
  speed: number; // m/s
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    heading: number | null;
  };
  timestamp: number;
}

interface SensorData {
  magnetometer: { x: number; y: number; z: number } | null;
}

interface ProcessedSensorData {
  magneticHeading: number;   // 0-359 degrees
}

interface BatteryData {
  batteryLevel: number | null;
  batteryState: Battery.BatteryState | null;
  lowPowerMode: boolean | null;
}

interface SettingsState {
  isFullScreen: boolean;
  keepAwake: boolean;
  darkMode: 'auto' | 'light' | 'dark';
}

export default function BikeComputerScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useI18n();

  const [location, setLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [distance, setDistance] = useState(0); // meters
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [pausedTime, setPausedTime] = useState(0); // total paused time in seconds
  const [pauseStartTime, setPauseStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // seconds
  const [maxSpeed, setMaxSpeed] = useState(0); // m/s
  const [avgSpeed, setAvgSpeed] = useState(0); // m/s
  const [lastLocation, setLastLocation] = useState<LocationData | null>(null);
  const [speedReadings, setSpeedReadings] = useState<number[]>([]);
  const [sensorData, setSensorData] = useState<SensorData>({
    magnetometer: null,
  });
  const [processedData, setProcessedData] = useState<ProcessedSensorData>({
    magneticHeading: 0,
  });
  const [batteryData, setBatteryData] = useState<BatteryData>({
    batteryLevel: null,
    batteryState: null,
    lowPowerMode: null,
  });
  const [settings, setSettings] = useState<SettingsState>({
    isFullScreen: false,
    keepAwake: false,
    darkMode: 'auto',
  });

  // Animation values
  const compassRotation = useRef(new Animated.Value(0)).current;
  const compassPulse = useRef(new Animated.Value(1)).current;

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const magnetometerSubscription = useRef<any>(null);
  const isPausedRef = useRef(false);

  useEffect(() => {
    requestLocationPermission();
    loadSettings();
    initializeSensors();
    initializeBattery();

    // Auto-start tracking when app loads
    setTimeout(() => {
      startTracking();
    }, 1000);

    return () => {
      stopTracking();
      stopSensors();
    };
  }, []);

  // Sync isPaused state with ref for location callback
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Process sensor data for user-friendly display
  useEffect(() => {
    if (sensorData.magnetometer) {
      processSensorData();
    }
  }, [sensorData]);

  useEffect(() => {
    if (isTracking && !isPaused && startTime) {
      timerRef.current = setInterval(() => {
        const currentTime = Date.now();
        const totalElapsed = Math.floor((currentTime - startTime.getTime()) / 1000);
        setElapsedTime(totalElapsed - pausedTime);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTracking, isPaused, startTime, pausedTime]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('tracker.permissionDenied'), t('tracker.locationPermissionRequired'));
        return;
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert(t('tracker.error'), t('tracker.failedLocationPermission'));
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const startTracking = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        await requestLocationPermission();
        return;
      }

      setIsTracking(true);
      setIsPaused(false);
      setPausedTime(0);
      setPauseStartTime(null);
      setStartTime(new Date());
      setDistance(0);
      setElapsedTime(0);
      setMaxSpeed(0);
      setAvgSpeed(0);
      setSpeedReadings([]);
      setLastLocation(null);

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (locationUpdate) => {
          const currentLocation: LocationData = {
            speed: locationUpdate.coords.speed || 0,
            coords: {
              latitude: locationUpdate.coords.latitude,
              longitude: locationUpdate.coords.longitude,
              altitude: locationUpdate.coords.altitude,
              accuracy: locationUpdate.coords.accuracy,
              heading: locationUpdate.coords.heading,
            },
            timestamp: locationUpdate.timestamp,
          };

          setLocation(currentLocation);

          // Only update distance and speed when not paused
          if (!isPausedRef.current) {
            // Calculate distance
            if (lastLocation) {
              const distanceIncrement = calculateDistance(
                lastLocation.coords.latitude,
                lastLocation.coords.longitude,
                currentLocation.coords.latitude,
                currentLocation.coords.longitude
              );
              setDistance(prev => prev + distanceIncrement);
            }

            // Update speed statistics
            const currentSpeed = Math.max(currentLocation.speed, 0);
            setMaxSpeed(prev => Math.max(prev, currentSpeed));

            setSpeedReadings(prev => {
              const newReadings = [...prev, currentSpeed];
              const avg = newReadings.reduce((sum, speed) => sum + speed, 0) / newReadings.length;
              setAvgSpeed(avg);
              return newReadings;
            });

            setLastLocation(currentLocation);
          }
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      Alert.alert(t('tracker.error'), t('tracker.startTrackingFailed'));
    }
  };

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsTracking(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const pauseTracking = () => {
    setIsPaused(true);
    setPauseStartTime(new Date());
  };

  const resumeTracking = () => {
    if (pauseStartTime) {
      const pauseDuration = Math.floor((Date.now() - pauseStartTime.getTime()) / 1000);
      setPausedTime(prev => prev + pauseDuration);
    }
    setIsPaused(false);
    setPauseStartTime(null);
  };

  const resetTracking = () => {
    setIsPaused(false);
    setPausedTime(0);
    setPauseStartTime(null);
    setLocation(null);
    setDistance(0);
    setStartTime(new Date());
    setElapsedTime(0);
    setMaxSpeed(0);
    setAvgSpeed(0);
    setSpeedReadings([]);
    setLastLocation(null);

    // Restart tracking after reset
    if (!isTracking) {
      startTracking();
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatSpeed = (mps: number): string => {
    const kmh = mps * 3.6;
    return `${kmh.toFixed(1)}`;
  };

  const processSensorData = () => {
    const newProcessedData: ProcessedSensorData = { ...processedData };

    // Calculate magnetic heading from magnetometer
    if (sensorData.magnetometer) {
      const { x, y } = sensorData.magnetometer;
      let heading = Math.atan2(y, x) * (180 / Math.PI);
      if (heading < 0) heading += 360;
      newProcessedData.magneticHeading = heading;

      // Animate compass rotation smoothly
      Animated.timing(compassRotation, {
        toValue: -heading,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Add subtle pulse animation when compass is active
      Animated.loop(
        Animated.sequence([
          Animated.timing(compassPulse, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
          Animated.timing(compassPulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }

    setProcessedData(newProcessedData);
  };

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('appSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const initializeBattery = async () => {
    try {
      const batteryLevel = await Battery.getBatteryLevelAsync();
      const batteryState = await Battery.getBatteryStateAsync();
      const lowPowerMode = await Battery.isLowPowerModeEnabledAsync();

      setBatteryData({
        batteryLevel,
        batteryState,
        lowPowerMode,
      });

      // Update battery info periodically
      const batteryInterval = setInterval(async () => {
        try {
          const level = await Battery.getBatteryLevelAsync();
          const state = await Battery.getBatteryStateAsync();
          const lowPower = await Battery.isLowPowerModeEnabledAsync();

          setBatteryData({
            batteryLevel: level,
            batteryState: state,
            lowPowerMode: lowPower,
          });
        } catch (error) {
          console.error('Error updating battery info:', error);
        }
      }, 30000); // Update every 30 seconds

      return () => clearInterval(batteryInterval);
    } catch (error) {
      console.error('Error initializing battery:', error);
    }
  };

  const initializeSensors = async () => {
    try {
      // Set sensor update intervals
      Magnetometer.setUpdateInterval(500);

      // Start sensor subscriptions
      magnetometerSubscription.current = Magnetometer.addListener(({ x, y, z }) => {
        setSensorData(prev => ({ ...prev, magnetometer: { x, y, z } }));
      });
    } catch (error) {
      console.error('Error initializing sensors:', error);
    }
  };

  const stopSensors = () => {
    if (magnetometerSubscription.current) {
      magnetometerSubscription.current.remove();
      magnetometerSubscription.current = null;
    }
  };

  const formatBatteryLevel = (level: number | null): string => {
    if (level === null) return 'N/A';
    return `${Math.round(level * 100)}%`;
  };

  const getBatteryIcon = (state: Battery.BatteryState | null, level: number | null) => {
    if (state === Battery.BatteryState.CHARGING) return 'battery-charging-full' as any;
    if (level === null) return 'battery-unknown' as any;
    if (level > 0.75) return 'battery-full' as any;
    if (level > 0.5) return 'battery-80' as any;
    if (level > 0.25) return 'battery-30' as any;
    return 'battery-alert' as any;
  };

  const getCompassDirection = (degrees: number): string => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  };

  // Helper function to safely get nested translation
  const getNestedTranslation = (key: string, fallback: string): string => {
    try {
      // Try to get the translation, but if it fails, use fallback
      const result = t(key);
      return typeof result === 'string' ? result : fallback;
    } catch {
      return fallback;
    }
  };

  const currentSpeed = isPaused ? 0 : (location?.speed || 0);

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="auto" hidden={settings.isFullScreen} />

      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>X-Tracker</ThemedText>
        {settings.isFullScreen && (
          <View style={styles.batteryInfo}>
            <MaterialIcons
              name={getBatteryIcon(batteryData.batteryState, batteryData.batteryLevel)}
              size={20}
              color={colors.text}
            />
            <ThemedText style={styles.batteryText}>
              {formatBatteryLevel(batteryData.batteryLevel)}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Main Speed Display */}
      <View style={[styles.speedContainer, { backgroundColor: colors.background }]}>
        <ThemedText style={styles.speedLabel}>{t('tracker.speed').toUpperCase()}</ThemedText>
        <ThemedText style={styles.speedValue}>
          {formatSpeed(currentSpeed)}
        </ThemedText>
        <ThemedText style={styles.speedUnit}>km/h</ThemedText>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statBox, { backgroundColor: colors.background }]}>
          <MaterialIcons name="timer" size={20} color={colors.text} />
          <ThemedText style={styles.statLabel}>{t('tracker.time').toUpperCase()}</ThemedText>
          <ThemedText style={styles.statValue}>{formatTime(elapsedTime)}</ThemedText>
        </View>

        <View style={[styles.statBox, { backgroundColor: colors.background }]}>
          <MaterialIcons name="location-on" size={20} color={colors.text} />
          <ThemedText style={styles.statLabel}>{t('tracker.distance').toUpperCase()}</ThemedText>
          <ThemedText style={styles.statValue}>{formatDistance(distance)}</ThemedText>
        </View>

        <View style={[styles.statBox, { backgroundColor: colors.background }]}>
          <MaterialIcons name="speed" size={20} color={colors.text} />
          <ThemedText style={styles.statLabel}>{t('tracker.maxSpeed').toUpperCase()}</ThemedText>
          <ThemedText style={styles.statValue}>{formatSpeed(maxSpeed)} km/h</ThemedText>
        </View>

        <View style={[styles.statBox, { backgroundColor: colors.background }]}>
          <MaterialIcons name="trending-up" size={20} color={colors.text} />
          <ThemedText style={styles.statLabel}>{t('tracker.avgSpeed').toUpperCase()}</ThemedText>
          <ThemedText style={styles.statValue}>{formatSpeed(avgSpeed)} km/h</ThemedText>
        </View>
      </View>

      {/* Enhanced Compass */}
      <View style={[styles.compassContainer, { backgroundColor: colors.background }]}>
        <ThemedText style={styles.compassTitle}>{t('tracker.compass')}</ThemedText>

        <Animated.View style={[styles.compassWrapper, { transform: [{ scale: compassPulse }] }]}>
          {/* Compass Rose Background */}
          <View style={styles.compassRoseBackground}>
            {/* Cardinal directions */}
            <View style={styles.cardinalDirections}>
              <ThemedText style={[styles.cardinalText, styles.northText]}>N</ThemedText>
              <ThemedText style={[styles.cardinalText, styles.eastText]}>E</ThemedText>
              <ThemedText style={[styles.cardinalText, styles.southText]}>S</ThemedText>
              <ThemedText style={[styles.cardinalText, styles.westText]}>W</ThemedText>
            </View>

            {/* Degree markers */}
            <View style={styles.degreeMarkers}>
              {Array.from({ length: 12 }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.degreeMark,
                    {
                      transform: [{ rotate: `${i * 30}deg` }],
                      backgroundColor: i % 3 === 0 ? colors.tint : colors.tabIconDefault,
                    }
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Compass Needle */}
          <Animated.View
            style={[
              styles.compassNeedle,
              {
                transform: [{
                  rotate: compassRotation.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg']
                  })
                }]
              }
            ]}
          >
            <View style={[styles.needleNorth, { backgroundColor: '#ff4444' }]} />
            <View style={[styles.needleSouth, { backgroundColor: colors.tabIconDefault }]} />
            <View style={[styles.needleCenter, { backgroundColor: colors.text }]} />
          </Animated.View>
        </Animated.View>

        <View style={styles.compassInfo}>
          <ThemedText style={styles.compassDirection}>
            {getCompassDirection(processedData.magneticHeading)}
          </ThemedText>
          <ThemedText style={styles.compassDegrees}>
            {Math.round(processedData.magneticHeading)}°
          </ThemedText>
        </View>
      </View>

      {/* Simplified Location Information */}
      {location && (
        <View style={[styles.locationContainer, { backgroundColor: colors.background }]}>
          <View style={styles.locationHeader}>
            <MaterialIcons name="gps-fixed" size={18} color={colors.tint} />
            <ThemedText style={styles.locationTitle}>{t('tracker.location')}</ThemedText>
          </View>

          <View style={styles.locationGrid}>
            <View style={styles.locationItem}>
              <ThemedText style={styles.locationLabel}>GPS:</ThemedText>
              <ThemedText style={styles.locationValue}>
                {location.coords.accuracy ? `±${location.coords.accuracy.toFixed(0)}m` : 'N/A'}
              </ThemedText>
            </View>

            <View style={styles.locationItem}>
              <ThemedText style={styles.locationLabel}>Altitude:</ThemedText>
              <ThemedText style={styles.locationValue}>
                {location.coords.altitude ? `${location.coords.altitude.toFixed(0)}m` : 'N/A'}
              </ThemedText>
            </View>
          </View>
        </View>
      )}

      {/* Additional Info */}
      {!location && (
        <View style={[styles.infoContainer, { backgroundColor: colors.background }]}>
          <View style={styles.infoRow}>
            <MaterialIcons name="location-off" size={20} color={colors.tabIconDefault} />
            <ThemedText style={styles.noLocationText}>
              {t('tracker.acquiringGPS')}
            </ThemedText>
          </View>
        </View>
      )}

      {/* Floating Control Button */}
      <TouchableOpacity
        style={[
          styles.floatingButton,
          { backgroundColor: isPaused ? '#44ff44' : '#ffaa00' }
        ]}
        onPress={isPaused ? resumeTracking : pauseTracking}
        onLongPress={() => {
          Alert.alert(
            t('tracker.confirmReset'),
            t('tracker.confirmResetMessage'),
            [
              { text: t('tracker.cancel'), style: 'cancel' },
              { text: t('tracker.reset'), style: 'destructive', onPress: resetTracking }
            ]
          );
        }}
        delayLongPress={800}
      >
        <Ionicons
          name={isPaused ? "play" : "pause"}
          size={28}
          color="white"
        />
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  batteryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 5,
  },
  speedContainer: {
    alignItems: 'center',
    padding: 20,
    marginBottom: 15,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    minHeight: 120,
  },
  speedLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 5,
  },
  speedValue: {
    fontSize: 42,
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
    lineHeight: 48,
    textAlign: 'center',
    includeFontPadding: false,
  },
  speedUnit: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statBox: {
    width: (width - 50) / 2,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
  },
  // Enhanced Compass Styles
  compassContainer: {
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  compassTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    opacity: 0.8,
  },
  compassWrapper: {
    width: 160,
    height: 160,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  compassRoseBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
  },
  cardinalDirections: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  cardinalText: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  northText: {
    top: 8,
    left: '50%',
    marginLeft: -6,
  },
  eastText: {
    right: 8,
    top: '50%',
    marginTop: -9,
  },
  southText: {
    bottom: 8,
    left: '50%',
    marginLeft: -6,
  },
  westText: {
    left: 8,
    top: '50%',
    marginTop: -9,
  },
  degreeMarkers: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  degreeMark: {
    position: 'absolute',
    width: 2,
    height: 12,
    top: 2,
    left: '50%',
    marginLeft: -1,
    transformOrigin: '50% 78px',
  },
  compassNeedle: {
    position: 'absolute',
    width: 4,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needleNorth: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 50,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  needleSouth: {
    position: 'absolute',
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 50,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  needleCenter: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
  },
  compassInfo: {
    alignItems: 'center',
  },
  compassDirection: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  compassDegrees: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
  },
  infoContainer: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  locationContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  locationItem: {
    width: '50%',
    marginBottom: 8,
    paddingRight: 6,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
  locationValue: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
  noLocationText: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.8,
    textAlign: 'center',
  },
});
