import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { strings } from '../../src/strings';

const TABS = [
  { name: 'today', title: strings.tabs.today, icon: 'sun' },
  { name: 'upcoming', title: strings.tabs.upcoming, icon: 'calendar' },
  { name: 'lists', title: strings.tabs.lists, icon: 'list' },
  { name: 'search', title: strings.tabs.search, icon: 'search' },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
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
