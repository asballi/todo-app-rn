import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import DateInput from '../src/components/DateInput';
import { showError } from '../src/components/confirm';
import { useTodoStore } from '../src/store/useTodoStore';
import { useNotificationPermission } from '../src/notifications/useReminders';
import { strings } from '../src/strings';
import { colors } from '../src/theme';

const t = strings.settings;

export default function SettingsScreen() {
  const defaultReminderTime = useTodoStore(s => s.settings.defaultReminderTime);
  const [permission, requestPermission] = useNotificationPermission();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t.title }} />

      <Text style={styles.label}>{t.defaultReminderTime}</Text>
      <View style={styles.card}>
        <DateInput
          mode="time"
          value={defaultReminderTime}
          onChange={time => useTodoStore.getState().updateSettings({ defaultReminderTime: time }).catch(showError)}
        />
        <Text style={styles.help}>{t.defaultReminderHelp}</Text>
      </View>

      <Text style={styles.label}>{t.notifications}</Text>
      <View style={styles.card}>
        {permission && <Text style={styles.text}>{t.permission[permission]}</Text>}
        {permission === 'undetermined' && (
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>{t.requestPermission}</Text>
          </TouchableOpacity>
        )}
        {Platform.OS === 'web' && <Text style={styles.help}>{strings.reminders.webNote}</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  text: {
    fontSize: 14,
    color: colors.text,
  },
  help: {
    fontSize: 13,
    color: colors.muted,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
