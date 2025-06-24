import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const events = [
  {
    id: '1',
    title: 'Meeting with Carlos Mendez',
    time: '10:00 AM',
    date: 'Today',
    type: 'meeting',
    color: '#25D366',
  },
  {
    id: '2',
    title: 'Follow up call with Ana García',
    time: '2:30 PM',
    date: 'Today',
    type: 'call',
    color: '#ff8800',
  },
  {
    id: '3',
    title: 'Quarterly Review',
    time: '9:00 AM',
    date: 'Tomorrow',
    type: 'meeting',
    color: '#ff4444',
  },
  {
    id: '4',
    title: 'Project deadline',
    time: 'All day',
    date: 'Friday',
    type: 'deadline',
    color: '#9c27b0',
  },
];

export default function CalendarScreen() {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'meeting': return 'people';
      case 'call': return 'call';
      case 'deadline': return 'flag';
      default: return 'calendar';
    }
  };

  const renderEvent = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.eventItem}>
      <View style={[styles.eventIndicator, { backgroundColor: item.color }]} />
      <View style={styles.eventIcon}>
        <Ionicons name={getEventIcon(item.type)} size={20} color={item.color} />
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <View style={styles.eventMeta}>
          <Text style={styles.eventTime}>{item.time}</Text>
          <Text style={styles.eventDate}>{item.date}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.eventAction}>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Calendar Header */}
      <View style={styles.calendarHeader}>
        <Text style={styles.monthYear}>December 2025</Text>
        <View style={styles.todayInfo}>
          <Text style={styles.todayLabel}>Today</Text>
          <Text style={styles.todayDate}>24</Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>4</Text>
          <Text style={styles.statLabel}>Events Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>12</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>2</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
      </View>

      {/* Events List */}
      <View style={styles.eventsSection}>
        <Text style={styles.sectionTitle}>Upcoming Events</Text>
        <FlatList
          data={events}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
        />
      </View>
      
      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  calendarHeader: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  monthYear: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  todayInfo: {
    alignItems: 'center',
  },
  todayLabel: {
    fontSize: 12,
    color: '#666',
  },
  todayDate: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#25D366',
  },
  statsContainer: {
    flexDirection: 'row',
    margin: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#25D366',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  eventsSection: {
    flex: 1,
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  eventItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  eventIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventTime: {
    fontSize: 14,
    color: '#666',
  },
  eventDate: {
    fontSize: 12,
    color: '#25D366',
    fontWeight: '500',
  },
  eventAction: {
    padding: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});