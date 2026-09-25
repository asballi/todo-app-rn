import React from 'react';
import { Stack, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { strings } from '../../../src/strings';
import { colors } from '../../../src/theme';

// Kategori/etiket sayfası doğrudan URL ile açılsa bile altında Listeler
// ana ekranı olur: geri butonu ve sekmeye tekrar basınca başa dönme çalışır.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function ListsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: strings.lists.title,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              accessibilityLabel={strings.settings.open}
              style={{ padding: 8 }}
            >
              <Feather name="settings" size={20} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen name="category/[id]" options={{ title: '' }} />
      <Stack.Screen name="tag/[id]" options={{ title: '' }} />
      <Stack.Screen name="overdue" options={{ title: strings.lists.overdue }} />
      <Stack.Screen name="important" options={{ title: strings.lists.important }} />
    </Stack>
  );
}
