# Expo React Native App Setup Guide - WhatsApp Style CRM

## Step 1: Create New Expo Project in Replit

1. **Create New Repl**:
   - Go to your Replit dashboard
   - Click "Create Repl"
   - Search for "Expo" in templates
   - Select "Expo React Native" template
   - Name it: `cortex-mobile-native`
   - Click "Create Repl"

## Step 2: Install Required Dependencies

Once your Expo project is created, install these dependencies in the Shell:

```bash
# Navigation dependencies
npx expo install @react-navigation/native
npx expo install @react-navigation/bottom-tabs
npx expo install @react-navigation/stack
npx expo install react-native-screens react-native-safe-area-context

# UI and Icons
npx expo install react-native-vector-icons
npx expo install @expo/vector-icons
npx expo install react-native-elements

# Camera and QR Scanner
npx expo install expo-camera
npx expo install expo-barcode-scanner

# HTTP requests
npx expo install axios

# Additional utilities
npx expo install react-native-paper
npx expo install expo-status-bar
```

## Step 3: Project Structure

Create this folder structure in your Expo project:

```
src/
├── components/
│   ├── common/
│   │   ├── Header.js
│   │   ├── TabBar.js
│   │   └── Avatar.js
│   ├── conversations/
│   │   ├── ConversationList.js
│   │   ├── ChatBubble.js
│   │   └── MessageInput.js
│   ├── tasks/
│   │   ├── TaskList.js
│   │   ├── TaskItem.js
│   │   └── TaskForm.js
│   └── contacts/
│       ├── ContactList.js
│       └── ContactItem.js
├── screens/
│   ├── ConversationsScreen.js
│   ├── TasksScreen.js
│   ├── ContactsScreen.js
│   ├── CalendarScreen.js
│   ├── FinanceScreen.js
│   └── SettingsScreen.js
├── services/
│   └── api.js
├── constants/
│   └── Colors.js
└── utils/
    └── helpers.js
```

## Step 4: WhatsApp Color Scheme

Create `src/constants/Colors.js`:

```javascript
export const Colors = {
  // WhatsApp Green
  primary: '#25D366',
  primaryDark: '#128C7E',
  primaryLight: '#DCF8C6',
  
  // UI Colors
  background: '#FFFFFF',
  surface: '#F7F8FA',
  text: '#000000',
  textSecondary: '#667781',
  border: '#E5E5E5',
  
  // Status Colors
  online: '#25D366',
  offline: '#8696A0',
  unread: '#25D366',
  
  // Chat Colors
  myMessage: '#DCF8C6',
  otherMessage: '#FFFFFF',
  
  // Priority Colors
  high: '#FF3B30',
  medium: '#FF9500',
  low: '#34C759'
};
```

## Step 5: Main App.js Structure

Replace your App.js with:

```javascript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import ConversationsScreen from './src/screens/ConversationsScreen';
import TasksScreen from './src/screens/TasksScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import FinanceScreen from './src/screens/FinanceScreen';
import SettingsScreen from './src/screens/SettingsScreen';

import { Colors } from './src/constants/Colors';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={Colors.primaryDark} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            switch (route.name) {
              case 'Conversations':
                iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
                break;
              case 'Tasks':
                iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
                break;
              case 'Contacts':
                iconName = focused ? 'people' : 'people-outline';
                break;
              case 'Calendar':
                iconName = focused ? 'calendar' : 'calendar-outline';
                break;
              case 'Finance':
                iconName = focused ? 'card' : 'card-outline';
                break;
              case 'Settings':
                iconName = focused ? 'settings' : 'settings-outline';
                break;
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarStyle: {
            backgroundColor: Colors.background,
            borderTopColor: Colors.border,
            paddingBottom: 5,
            height: 60,
          },
          headerStyle: {
            backgroundColor: Colors.primaryDark,
          },
          headerTintColor: Colors.background,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        })}
      >
        <Tab.Screen name="Conversations" component={ConversationsScreen} />
        <Tab.Screen name="Tasks" component={TasksScreen} />
        <Tab.Screen name="Contacts" component={ContactsScreen} />
        <Tab.Screen name="Calendar" component={CalendarScreen} />
        <Tab.Screen name="Finance" component={FinanceScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
```

## Step 6: API Service

Create `src/services/api.js`:

```javascript
import axios from 'axios';

// Replace with your Replit app URL
const BASE_URL = 'https://your-replit-url.replit.dev/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // Conversations
  getConversations: (spaceId) => 
    api.get(`/whatsapp/conversations/${spaceId}`),
  
  // Tasks
  getTasks: (instanceId) => 
    api.get(`/crm/tasks${instanceId ? `?instanceId=${instanceId}` : ''}`),
  
  createTask: (taskData) => 
    api.post('/crm/tasks', taskData),
  
  updateTask: (taskId, updates) => 
    api.patch(`/crm/tasks/${taskId}`, updates),
  
  // Contacts
  getContacts: (spaceId) => 
    api.get(`/contacts/${spaceId}`),
  
  // Messages
  sendMessage: (data) => 
    api.post('/whatsapp/send-message', data),
};

export default api;
```

## Step 7: Sample Screen - ConversationsScreen.js

Create `src/screens/ConversationsScreen.js`:

```javascript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { apiService } from '../services/api';

const ConversationsScreen = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await apiService.getConversations('7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
      setConversations(response.data.slice(0, 20));
    } catch (error) {
      console.log('Using sample data - API not available');
      setConversations([
        {
          id: 1,
          contact_name: 'María González',
          last_message: 'Thanks for the information',
          last_message_at: new Date(),
          unread_count: 2,
        },
        {
          id: 2,
          contact_name: 'Carlos López',
          last_message: 'When can we meet?',
          last_message_at: new Date(),
          unread_count: 0,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity 
      style={styles.conversationItem}
      onPress={() => Alert.alert('Open Chat', `Chat with ${item.contact_name}`)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.contact_name?.charAt(0)?.toUpperCase() || '?'}
        </Text>
      </View>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.contactName}>{item.contact_name}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.last_message_at).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        
        <View style={styles.messageRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.last_message}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: Colors.background,
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
    color: Colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ConversationsScreen;
```

## Step 8: Running Your App

1. **Start the Expo development server**:
   ```bash
   npx expo start
   ```

2. **Access via QR Code**:
   - The terminal will show a QR code
   - Install "Expo Go" app on your phone
   - Scan the QR code with Expo Go
   - Your app will load on your device

3. **Web Preview** (optional):
   ```bash
   npx expo start --web
   ```

## Step 9: Connect to Your Backend

Update the `BASE_URL` in `src/services/api.js` to point to your current Replit backend:

```javascript
const BASE_URL = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api';
```

## Step 10: Build Complete Screens

Follow the same pattern as ConversationsScreen to create:
- TasksScreen (with real task data)
- ContactsScreen (with real contact data)
- CalendarScreen (for events)
- FinanceScreen (for financial data)
- SettingsScreen (for app settings)

## Next Steps

Once you have the basic structure:
1. Add QR code scanner functionality using `expo-barcode-scanner`
2. Implement real-time updates with WebSocket/SSE
3. Add offline capability with AsyncStorage
4. Implement push notifications
5. Add authentication

This creates a native WhatsApp-style mobile app that connects to your existing Cortex CRM backend with real data integration.