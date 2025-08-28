import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useI18n } from '@/hooks/useI18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

export default function BikeComputerScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useI18n();

  const [location, setLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState(0); // meters
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // seconds
  const [maxSpeed, setMaxSpeed] = useState(0); // m/s
  const [avgSpeed, setAvgSpeed] = useState(0); // m/s
  const [lastLocation, setLastLocation] = useState<LocationData | null>(null);
  const [speedReadings, setSpeedReadings] = useState<number[]>([]);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    requestLocationPermission();
    return () => {
      stopTracking();
    };
  }, []);

  useEffect(() => {
    if (isTracking && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000));
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
  }, [isTracking, startTime]);

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

  const resetTracking = () => {
    stopTracking();
    setLocation(null);
    setDistance(0);
    setStartTime(null);
    setElapsedTime(0);
    setMaxSpeed(0);
    setAvgSpeed(0);
    setSpeedReadings([]);
    setLastLocation(null);
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

  const currentSpeed = location?.speed || 0;

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="auto" />

      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>X-Tracker</ThemedText>
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

      {/* Location Information */}
      {location && (
        <View style={[styles.locationContainer, { backgroundColor: colors.background }]}>
          <View style={styles.locationHeader}>
            <MaterialIcons name="location-on" size={20} color={colors.tint} />
            <ThemedText style={styles.locationTitle}>Location Information</ThemedText>
          </View>

          <View style={styles.locationGrid}>
            <View style={styles.locationItem}>
              <ThemedText style={styles.locationLabel}>Latitude:</ThemedText>
              <ThemedText style={styles.locationValue}>
                {location.coords.latitude.toFixed(6)}°
              </ThemedText>
            </View>

            <View style={styles.locationItem}>
              <ThemedText style={styles.locationLabel}>Longitude:</ThemedText>
              <ThemedText style={styles.locationValue}>
                {location.coords.longitude.toFixed(6)}°
              </ThemedText>
            </View>

            <View style={styles.locationItem}>
              <ThemedText style={styles.locationLabel}>Altitude:</ThemedText>
              <ThemedText style={styles.locationValue}>
                {location.coords.altitude ? `${location.coords.altitude.toFixed(1)}m` : 'N/A'}
              </ThemedText>
            </View>

            <View style={styles.locationItem}>
              <ThemedText style={styles.locationLabel}>GPS Time:</ThemedText>
              <ThemedText style={styles.locationValue}>
                {new Date(location.timestamp).toLocaleTimeString()}
              </ThemedText>
            </View>

            <View style={styles.locationItem}>
              <ThemedText style={styles.locationLabel}>GPS Accuracy:</ThemedText>
              <ThemedText style={styles.locationValue}>
                {location.coords.accuracy ? `±${location.coords.accuracy.toFixed(1)}m` : 'N/A'}
              </ThemedText>
            </View>

            <View style={styles.locationItem}>
              <ThemedText style={styles.locationLabel}>Heading:</ThemedText>
              <ThemedText style={styles.locationValue}>
                {location.coords.heading ? `${location.coords.heading.toFixed(0)}°` : 'N/A'}
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
              {isTracking ? t('tracker.acquiringGPS') : t('tracker.startTrackingInfo')}
            </ThemedText>
          </View>
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.controlContainer}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.startButton,
            { backgroundColor: isTracking ? '#ff4444' : '#44ff44' }
          ]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <Ionicons
            name={isTracking ? "stop" : "play"}
            size={24}
            color="white"
          />
          <Text style={styles.buttonText}>
            {isTracking ? t('tracker.stopRide').toUpperCase() : t('tracker.startRide').toUpperCase()}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.resetButton, { backgroundColor: colors.tabIconDefault }]}
          onPress={resetTracking}
        >
          <MaterialIcons name="refresh" size={24} color="white" />
          <Text style={styles.buttonText}>{t('tracker.resetRide').toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 90, // Reduced padding for button space
  },
  header: {
    alignItems: 'center',
    marginTop: 20, // Reduced from 40
    marginBottom: 15, // Reduced from 30
  },
  headerTitle: {
    fontSize: 20, // Reduced from 24
    fontWeight: 'bold',
  },
  speedContainer: {
    alignItems: 'center',
    padding: 20, // Reduced from 30
    marginBottom: 15, // Reduced from 30
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    minHeight: 120, // Reduced from 180
  },
  speedLabel: {
    fontSize: 14, // Reduced from 16
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 5, // Reduced from 10
  },
  speedValue: {
    fontSize: 42, // Reduced from 56
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
    lineHeight: 48, // Reduced from 64
    textAlign: 'center',
    includeFontPadding: false,
  },
  speedUnit: {
    fontSize: 16, // Reduced from 18
    fontWeight: '500',
    opacity: 0.8,
    marginTop: 4, // Reduced from 8
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12, // Reduced from 20
  },
  statBox: {
    width: (width - 50) / 2, // Reduced container width
    padding: 12, // Reduced from 20
    borderRadius: 12, // Reduced from 15
    alignItems: 'center',
    marginBottom: 8, // Reduced from 15
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statLabel: {
    fontSize: 11, // Reduced from 12
    fontWeight: '600',
    opacity: 0.7,
    marginTop: 4, // Reduced from 8
    marginBottom: 2, // Reduced from 5
  },
  statValue: {
    fontSize: 16, // Reduced from 18
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
  },
  infoContainer: {
    padding: 12, // Reduced from 15
    borderRadius: 12, // Reduced from 15
    marginBottom: 8, // Further reduced
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
  controlContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12, // Reduced from 15
    position: 'absolute',
    bottom: 16, // Reduced from 20
    left: 16, // Reduced from 20
    right: 16, // Reduced from 20
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12, // Reduced from 16
    borderRadius: 12, // Reduced from 15
    gap: 6, // Reduced from 8
  },
  startButton: {
    flex: 2,
  },
  resetButton: {
    flex: 1,
  },
  buttonText: {
    color: 'white',
    fontSize: 14, // Reduced from 16
    fontWeight: 'bold',
  },
  locationContainer: {
    padding: 16, // Reduced from 20
    borderRadius: 12, // Reduced from 15
    marginBottom: 12, // Reduced from 20
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // Reduced from 10
  },
  locationTitle: {
    fontSize: 14, // Reduced from 16
    fontWeight: '600',
    marginLeft: 6, // Reduced from 8
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  locationItem: {
    width: '50%',
    marginBottom: 8, // Reduced from 12
    paddingRight: 6, // Reduced from 8
  },
  locationLabel: {
    fontSize: 12, // Reduced from 14
    fontWeight: '500',
    opacity: 0.8,
  },
  locationValue: {
    fontSize: 12, // Reduced from 14
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
  noLocationText: {
    fontSize: 13, // Reduced from 14
    fontWeight: '500',
    opacity: 0.8,
    textAlign: 'center',
  },
});
