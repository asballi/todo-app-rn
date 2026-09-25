import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../src/theme';

const TABS = [
  { name: 'today', title: 'Bugün', icon: 'sun' },
  { name: 'upcoming', title: 'Yaklaşan', icon: 'calendar' },
  { name: 'lists', title: 'Listeler', icon: 'list' },
  { name: 'search', title: 'Ara', icon: 'search' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => <Feather name={tab.icon} size={size} color={color} />,
            // Listeler sekmesi kendi Stack başlığını kullanır.
            headerShown: tab.name !== 'lists',
          }}
        />
      ))}
    </Tabs>
  );
}
