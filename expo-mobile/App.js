import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  RefreshControl,
  SafeAreaView 
} from 'react-native';

export default function App() {
  const [activeTab, setActiveTab] = useState('chats');
  const [conversations, setConversations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSampleData();
  }, []);

  const loadSampleData = () => {
    setConversations([
      { id: 1, name: 'María González', lastMessage: 'Thanks for the information', time: '2:30 PM', unread: 2 },
      { id: 2, name: 'Carlos López', lastMessage: 'When can we meet?', time: '1:45 PM', unread: 0 },
      { id: 3, name: 'Ana Rodríguez', lastMessage: 'Perfect, see you tomorrow', time: '12:20 PM', unread: 1 },
      { id: 4, name: 'Juan Pérez', lastMessage: 'Sending documents...', time: '11:15 AM', unread: 0 },
      { id: 5, name: 'Elena Martín', lastMessage: 'Ok, understood', time: '10:30 AM', unread: 3 },
    ]);

    setTasks([
      { id: 1, title: 'Call new client', priority: 'high', due: 'Today 3:00 PM' },
      { id: 2, title: 'Send commercial proposal', priority: 'medium', due: 'Tomorrow' },
      { id: 3, title: 'Review pending contracts', priority: 'low', due: 'Jun 25' },
      { id: 4, title: 'Sales team meeting', priority: 'medium', due: 'Jun 26' },
    ]);

    setContacts([
      { id: 1, name: 'María González', phone: '+52 55 1234 5678' },
      { id: 2, name: 'Carlos López', phone: '+52 55 2345 6789' },
      { id: 3, name: 'Ana Rodríguez', phone: '+52 55 3456 7890' },
      { id: 4, name: 'Juan Pérez', phone: '+52 55 4567 8901' },
      { id: 5, name: 'Elena Martín', phone: '+52 55 5678 9012' },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      loadSampleData();
      setRefreshing(false);
    }, 1000);
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity style={styles.conversationItem}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.contactName}>{item.name}</Text>
          <View style={styles.rightHeader}>
            <Text style={styles.timestamp}>{item.time}</Text>
            {item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.lastMessage}>{item.lastMessage}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderTask = ({ item }) => (
    <View style={styles.taskItem}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle}>{item.title}</Text>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
          <Text style={styles.priorityText}>{item.priority}</Text>
        </View>
      </View>
      <Text style={styles.taskDue}>{item.due}</Text>
    </View>
  );

  const renderContact = ({ item }) => (
    <View style={styles.contactItem}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactPhone}>{item.phone}</Text>
      </View>
    </View>
  );

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ffebee';
      case 'medium': return '#fff3e0';
      case 'low': return '#e8f5e8';
      default: return '#f5f5f5';
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'chats':
        return (
          <FlatList
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            style={styles.list}
          />
        );
      
      case 'tasks':
        return (
          <FlatList
            data={tasks}
            renderItem={renderTask}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            style={styles.list}
            contentContainerStyle={styles.tasksList}
          />
        );
      
      case 'contacts':
        return (
          <View style={styles.contactsContainer}>
            <TextInput
              style={styles.searchBar}
              placeholder="Search contacts..."
              placeholderTextColor="#999"
            />
            <FlatList
              data={contacts}
              renderItem={renderContact}
              keyExtractor={(item) => item.id.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            />
          </View>
        );
      
      case 'finance':
        return (
          <ScrollView style={styles.financeContainer} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceAmount}>$45,280.50</Text>
              <Text style={styles.balanceLabel}>Total Balance</Text>
            </View>
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>Income</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>Transfer</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
      
      default:
        return (
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonTitle}>Coming Soon</Text>
            <Text style={styles.comingSoonText}>This feature will be available soon</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cortex CRM</Text>
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'chats' && styles.navItemActive]}
          onPress={() => setActiveTab('chats')}
        >
          <Text style={[styles.navText, activeTab === 'chats' && styles.navTextActive]}>Chats</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'tasks' && styles.navItemActive]}
          onPress={() => setActiveTab('tasks')}
        >
          <Text style={[styles.navText, activeTab === 'tasks' && styles.navTextActive]}>Tasks</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'contacts' && styles.navItemActive]}
          onPress={() => setActiveTab('contacts')}
        >
          <Text style={[styles.navText, activeTab === 'contacts' && styles.navTextActive]}>Contacts</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'finance' && styles.navItemActive]}
          onPress={() => setActiveTab('finance')}
        >
          <Text style={[styles.navText, activeTab === 'finance' && styles.navTextActive]}>Finance</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'settings' && styles.navItemActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.navText, activeTab === 'settings' && styles.navTextActive]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#075E54',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  navItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#25D366',
  },
  navText: {
    fontSize: 12,
    color: '#999',
  },
  navTextActive: {
    color: '#25D366',
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  unreadBadge: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  tasksList: {
    padding: 16,
  },
  taskItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
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
    color: '#333',
    textTransform: 'capitalize',
  },
  taskDue: {
    fontSize: 12,
    color: '#666',
  },
  contactsContainer: {
    flex: 1,
  },
  searchBar: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  financeContainer: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#25D366',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  comingSoon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});