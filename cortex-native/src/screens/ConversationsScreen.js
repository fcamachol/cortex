import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';

export default function ConversationsScreen() {
  const [conversations, setConversations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      // Replace with your actual backend URL
      const response = await fetch('http://localhost:5000/api/whatsapp/conversations/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.slice(0, 20));
      }
    } catch (error) {
      console.log('Using sample data for demo');
      // Sample data for demo
      setConversations([
        { id: 1, contact_name: 'María González', last_message: 'Thanks for the information', last_message_at: new Date(), unread_count: 2 },
        { id: 2, contact_name: 'Carlos López', last_message: 'When can we meet?', last_message_at: new Date(), unread_count: 0 },
        { id: 3, contact_name: 'Ana Rodríguez', last_message: 'Perfect, see you tomorrow', last_message_at: new Date(), unread_count: 1 },
        { id: 4, contact_name: 'Juan Pérez', last_message: 'Sending documents...', last_message_at: new Date(), unread_count: 0 },
        { id: 5, contact_name: 'Elena Martín', last_message: 'Ok, understood', last_message_at: new Date(), unread_count: 3 },
      ]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations().finally(() => setRefreshing(false));
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity style={styles.conversationItem}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.contact_name?.charAt(0) || '?'}
        </Text>
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.contactName}>
            {item.contact_name || 'Unknown'}
          </Text>
          <View style={styles.rightHeader}>
            <Text style={styles.timestamp}>
              {new Date(item.last_message_at).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
            {item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread_count}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message || 'No messages'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
});