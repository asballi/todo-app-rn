import React from 'react';
import { Stack } from 'expo-router';
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
      <Stack.Screen name="index" options={{ title: 'Listeler' }} />
      <Stack.Screen name="category/[id]" options={{ title: '' }} />
      <Stack.Screen name="tag/[id]" options={{ title: '' }} />
      <Stack.Screen name="overdue" options={{ title: 'Gecikmiş' }} />
    </Stack>
  );
}
