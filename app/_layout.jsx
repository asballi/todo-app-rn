import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTodoStore } from '../src/store/useTodoStore';
import { colors } from '../src/theme';

export default function RootLayout() {
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
          <Text style={styles.error}>Veriler yüklenemedi: {error}</Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="category-form" options={modalOptions} />
        <Stack.Screen name="task/new" options={modalOptions} />
        <Stack.Screen name="task/[id]" options={modalOptions} />
      </Stack>
    </>
  );
}

const modalOptions = {
  presentation: 'modal',
  headerShown: true,
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: '700', color: colors.text },
  contentStyle: { backgroundColor: colors.background },
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  error: {
    color: '#e05c5c',
    textAlign: 'center',
  },
});
