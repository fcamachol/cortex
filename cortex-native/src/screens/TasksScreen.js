import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';

export default function TasksScreen() {
  const [tasks, setTasks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/crm/tasks/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.slice(0, 20));
      }
    } catch (error) {
      console.log('Using sample data for demo');
      setTasks([
        { id: 1, title: 'Call new client', priority: 'high', due_date: new Date(), status: 'pending' },
        { id: 2, title: 'Send commercial proposal', priority: 'medium', due_date: new Date(Date.now() + 86400000), status: 'in_progress' },
        { id: 3, title: 'Review pending contracts', priority: 'low', due_date: new Date(Date.now() + 172800000), status: 'pending' },
        { id: 4, title: 'Sales team meeting', priority: 'medium', due_date: new Date(Date.now() + 259200000), status: 'scheduled' },
      ]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks().finally(() => setRefreshing(false));
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#d32f2f';
      case 'medium': return '#f57c00';
      case 'low': return '#388e3c';
      default: return '#f57c00';
    }
  };

  const getPriorityBgColor = (priority) => {
    switch (priority) {
      case 'high': return '#ffe6e6';
      case 'medium': return '#fff3e0';
      case 'low': return '#e8f5e8';
      default: return '#fff3e0';
    }
  };

  const renderTask = ({ item }) => (
    <TouchableOpacity style={styles.taskItem}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle} numberOfLines={2}>
          {item.title || 'Untitled Task'}
        </Text>
        <View style={[
          styles.priorityBadge,
          { backgroundColor: getPriorityBgColor(item.priority) }
        ]}>
          <Text style={[
            styles.priorityText,
            { color: getPriorityColor(item.priority) }
          ]}>
            {item.priority || 'Medium'}
          </Text>
        </View>
      </View>
      <Text style={styles.taskDue}>
        {item.due_date 
          ? new Date(item.due_date).toLocaleDateString('en-US')
          : 'No due date'
        }
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 16,
  },
  taskItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    marginRight: 12,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  taskDue: {
    fontSize: 12,
    color: '#666',
  },
});