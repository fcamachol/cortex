import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

// Import screens
import ConversationsScreen from './src/screens/ConversationsScreen';
import TasksScreen from './src/screens/TasksScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import FinanceScreen from './src/screens/FinanceScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#075E54" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Conversations') {
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
            } else if (route.name === 'Tasks') {
              iconName = focused ? 'checkbox' : 'checkbox-outline';
            } else if (route.name === 'Contacts') {
              iconName = focused ? 'people' : 'people-outline';
            } else if (route.name === 'Calendar') {
              iconName = focused ? 'calendar' : 'calendar-outline';
            } else if (route.name === 'Finance') {
              iconName = focused ? 'card' : 'card-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#25D366',
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#e0e0e0',
            height: 90,
            paddingBottom: 10,
            paddingTop: 10,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
          headerStyle: {
            backgroundColor: '#075E54',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        })}
      >
        <Tab.Screen 
          name="Conversations" 
          component={ConversationsScreen}
          options={{ title: 'Cortex CRM' }}
        />
        <Tab.Screen 
          name="Tasks" 
          component={TasksScreen}
          options={{ title: 'Tasks' }}
        />
        <Tab.Screen 
          name="Contacts" 
          component={ContactsScreen}
          options={{ title: 'Contacts' }}
        />
        <Tab.Screen 
          name="Calendar" 
          component={CalendarScreen}
          options={{ title: 'Calendar' }}
        />
        <Tab.Screen 
          name="Finance" 
          component={FinanceScreen}
          options={{ title: 'Finance' }}
        />
        <Tab.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}