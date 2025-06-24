import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ContactsScreen() {
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/contacts/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
      if (response.ok) {
        const data = await response.json();
        setContacts(data.slice(0, 50));
      }
    } catch (error) {
      console.log('Using sample data for demo');
      setContacts([
        { id: 1, name: 'María González', primary_phone: '+52 55 1234 5678' },
        { id: 2, name: 'Carlos López', primary_phone: '+52 55 2345 6789' },
        { id: 3, name: 'Ana Rodríguez', primary_phone: '+52 55 3456 7890' },
        { id: 4, name: 'Juan Pérez', primary_phone: '+52 55 4567 8901' },
        { id: 5, name: 'Elena Martín', primary_phone: '+52 55 5678 9012' },
      ]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchContacts().finally(() => setRefreshing(false));
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.primary_phone?.includes(searchQuery)
  );

  const renderContact = ({ item }) => (
    <TouchableOpacity style={styles.contactItem}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.name?.charAt(0) || '?'}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>
          {item.name || 'Unknown Contact'}
        </Text>
        <Text style={styles.contactPhone}>
          {item.primary_phone || 'No phone'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      <FlatList
        data={filteredContacts}
        renderItem={renderContact}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
  },
});