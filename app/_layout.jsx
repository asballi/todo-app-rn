import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTodoStore } from '../src/store/useTodoStore';
import { useReminders } from '../src/notifications/useReminders';
import ReminderBanner from '../src/components/ReminderBanner';
import UndoBar from '../src/components/UndoBar';
import { useThemedStyles, useTheme } from '../src/theme';
import { strings } from '../src/strings';

export default function RootLayout() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const status = useTodoStore(s => s.status);
  const error = useTodoStore(s => s.error);

  // Veri taşıma (migration) ve yükleme uygulama açılışında bir kez yapılır.
  useEffect(() => {
    useTodoStore.getState().init();
  }, []);

  if (status !== 'ready') {
    return (
      <View style={styles.center}>
        {status === 'error' ? (
          <Text style={styles.error}>{strings.common.loadFailed(error)}</Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  const modal = modalOptions(colors);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="category-form" options={modal} />
        <Stack.Screen name="task/new" options={modal} />
        <Stack.Screen name="task/[id]" options={modal} />
        <Stack.Screen name="tag-form" options={modal} />
        <Stack.Screen name="manage-tags" options={modal} />
        <Stack.Screen name="settings" options={modal} />
      </Stack>
      <ReminderManager />
      <ReminderBanner />
      <UndoBar />
    </>
  );
}

// Veriler hazır olduktan sonra bildirim eşitlemesini başlatır.
function ReminderManager() {
  useReminders();
  return null;
}

const modalOptions = colors => ({
  presentation: 'modal',
  headerShown: true,
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: '700', color: colors.text },
  contentStyle: { backgroundColor: colors.background },
});

const makeStyles = colors => StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
});
