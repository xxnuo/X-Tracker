import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';

const { width } = Dimensions.get('window');

interface RideRecord {
  id: string;
  date: string;
  duration: number; // seconds
  distance: number; // meters
  maxSpeed: number; // m/s
  avgSpeed: number; // m/s
}

export default function StatisticsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [rideHistory, setRideHistory] = useState<RideRecord[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalDistance: 0,
    totalTime: 0,
    totalRides: 0,
    bestSpeed: 0,
    averageSpeed: 0,
  });

  useEffect(() => {
    loadRideHistory();
  }, []);

  const loadRideHistory = () => {
    // Mock data for demonstration - in a real app you would use AsyncStorage or a database
    const mockHistory: RideRecord[] = [
      {
        id: '1',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 3600, // 1 hour
        distance: 25000, // 25km
        maxSpeed: 12.5, // ~45 km/h
        avgSpeed: 6.94, // ~25 km/h
      },
      {
        id: '2',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 2700, // 45 minutes
        distance: 18000, // 18km
        maxSpeed: 11.1, // ~40 km/h
        avgSpeed: 6.67, // ~24 km/h
      },
      {
        id: '3',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 4200, // 1h 10m
        distance: 32000, // 32km
        maxSpeed: 13.9, // ~50 km/h
        avgSpeed: 7.62, // ~27.4 km/h
      },
    ];
    
    setRideHistory(mockHistory);
    calculateTotalStats(mockHistory);
  };

  const calculateTotalStats = (history: RideRecord[]) => {
    const totalDistance = history.reduce((sum, ride) => sum + ride.distance, 0);
    const totalTime = history.reduce((sum, ride) => sum + ride.duration, 0);
    const totalRides = history.length;
    const bestSpeed = Math.max(...history.map(ride => ride.maxSpeed), 0);
    const averageSpeed = totalTime > 0 ? totalDistance / totalTime : 0;

    setTotalStats({
      totalDistance,
      totalTime,
      totalRides,
      bestSpeed,
      averageSpeed,
    });
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatSpeed = (mps: number): string => {
    const kmh = mps * 3.6;
    return `${kmh.toFixed(1)} km/h`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>X-Tracker Statistics</ThemedText>
        </View>

        {/* Overall Stats */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Overall Statistics</ThemedText>
          
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.background }]}>
              <MaterialIcons name="location-on" size={24} color={colors.tint} />
              <ThemedText style={styles.statValue}>{formatDistance(totalStats.totalDistance)}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Distance</ThemedText>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.background }]}>
              <MaterialIcons name="timer" size={24} color={colors.tint} />
              <ThemedText style={styles.statValue}>{formatTime(totalStats.totalTime)}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Time</ThemedText>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.background }]}>
              <FontAwesome5 name="bicycle" size={24} color={colors.tint} />
              <ThemedText style={styles.statValue}>{totalStats.totalRides}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Rides</ThemedText>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.background }]}>
              <MaterialIcons name="speed" size={24} color={colors.tint} />
              <ThemedText style={styles.statValue}>{formatSpeed(totalStats.bestSpeed)}</ThemedText>
              <ThemedText style={styles.statLabel}>Best Speed</ThemedText>
            </View>
          </View>
        </View>

        {/* Recent Rides */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Recent Rides</ThemedText>
          
          {rideHistory.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
              <FontAwesome5 name="bicycle" size={48} color={colors.tabIconDefault} />
              <ThemedText style={styles.emptyText}>No rides recorded yet</ThemedText>
              <ThemedText style={styles.emptySubtext}>Start your first ride to see statistics here</ThemedText>
            </View>
          ) : (
            <View style={styles.ridesList}>
              {rideHistory.slice().reverse().slice(0, 10).map((ride) => (
                <View key={ride.id} style={[styles.rideCard, { backgroundColor: colors.background }]}>
                  <View style={styles.rideHeader}>
                    <View style={styles.rideDate}>
                      <MaterialIcons name="event" size={16} color={colors.text} />
                      <ThemedText style={styles.rideDateText}>{formatDate(ride.date)}</ThemedText>
                    </View>
                    <ThemedText style={styles.rideDuration}>{formatTime(ride.duration)}</ThemedText>
                  </View>
                  
                  <View style={styles.rideStats}>
                    <View style={styles.rideStat}>
                      <ThemedText style={styles.rideStatLabel}>Distance</ThemedText>
                      <ThemedText style={styles.rideStatValue}>{formatDistance(ride.distance)}</ThemedText>
                    </View>
                    
                    <View style={styles.rideStat}>
                      <ThemedText style={styles.rideStatLabel}>Avg Speed</ThemedText>
                      <ThemedText style={styles.rideStatValue}>{formatSpeed(ride.avgSpeed)}</ThemedText>
                    </View>
                    
                    <View style={styles.rideStat}>
                      <ThemedText style={styles.rideStatLabel}>Max Speed</ThemedText>
                      <ThemedText style={styles.rideStatValue}>{formatSpeed(ride.maxSpeed)}</ThemedText>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Monthly Summary */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>This Month</ThemedText>
          
          <View style={[styles.monthlyCard, { backgroundColor: colors.background }]}>
            <View style={styles.monthlyRow}>
              <View style={styles.monthlyItem}>
                <MaterialIcons name="location-on" size={20} color={colors.tint} />
                <View>
                  <ThemedText style={styles.monthlyValue}>
                    {formatDistance(getMonthlyDistance())}
                  </ThemedText>
                  <ThemedText style={styles.monthlyLabel}>Distance</ThemedText>
                </View>
              </View>
              
              <View style={styles.monthlyItem}>
                <FontAwesome5 name="bicycle" size={20} color={colors.tint} />
                <View>
                  <ThemedText style={styles.monthlyValue}>{getMonthlyRides()}</ThemedText>
                  <ThemedText style={styles.monthlyLabel}>Rides</ThemedText>
                </View>
              </View>
            </View>
            
            <View style={styles.monthlyRow}>
              <View style={styles.monthlyItem}>
                <MaterialIcons name="timer" size={20} color={colors.tint} />
                <View>
                  <ThemedText style={styles.monthlyValue}>
                    {formatTime(getMonthlyTime())}
                  </ThemedText>
                  <ThemedText style={styles.monthlyLabel}>Time</ThemedText>
                </View>
              </View>
              
              <View style={styles.monthlyItem}>
                <MaterialIcons name="trending-up" size={20} color={colors.tint} />
                <View>
                  <ThemedText style={styles.monthlyValue}>
                    {formatSpeed(getMonthlyAvgSpeed())}
                  </ThemedText>
                  <ThemedText style={styles.monthlyLabel}>Avg Speed</ThemedText>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );

  function getMonthlyDistance(): number {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return rideHistory
      .filter(ride => {
        const rideDate = new Date(ride.date);
        return rideDate.getMonth() === currentMonth && rideDate.getFullYear() === currentYear;
      })
      .reduce((sum, ride) => sum + ride.distance, 0);
  }

  function getMonthlyRides(): number {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return rideHistory.filter(ride => {
      const rideDate = new Date(ride.date);
      return rideDate.getMonth() === currentMonth && rideDate.getFullYear() === currentYear;
    }).length;
  }

  function getMonthlyTime(): number {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return rideHistory
      .filter(ride => {
        const rideDate = new Date(ride.date);
        return rideDate.getMonth() === currentMonth && rideDate.getFullYear() === currentYear;
      })
      .reduce((sum, ride) => sum + ride.duration, 0);
  }

  function getMonthlyAvgSpeed(): number {
    const monthlyDistance = getMonthlyDistance();
    const monthlyTime = getMonthlyTime();
    
    return monthlyTime > 0 ? monthlyDistance / monthlyTime : 0;
  }
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (width - 55) / 2,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
    marginTop: 10,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
    textAlign: 'center',
  },
  emptyState: {
    padding: 40,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  ridesList: {
    gap: 12,
  },
  rideCard: {
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rideDateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  rideDuration: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
  },
  rideStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rideStat: {
    alignItems: 'center',
  },
  rideStatLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  rideStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
  },
  monthlyCard: {
    padding: 20,
    borderRadius: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  monthlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  monthlyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  monthlyValue: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
  },
  monthlyLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
});
