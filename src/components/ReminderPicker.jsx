import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import Chip from './Chip';
import { useTodoStore } from '../store/useTodoStore';
import { useNotificationPermission } from '../notifications/useReminders';
import { REMINDER_OPTIONS, MAX_REMINDERS } from '../domain/reminders';
import { strings } from '../strings';
import { colors } from '../theme';

const t = strings.reminders;

// Bitiş anına göre hatırlatıcılar (en fazla 3). İlk hatırlatıcı eklenirken
// bildirim izni istenir; reddedilirse uyarı gösterilir, seçim yine kaydedilir.
export default function ReminderPicker({ value, dueTime, onChange }) {
  const defaultTime = useTodoStore(s => s.settings.defaultReminderTime);
  const [permission, requestPermission] = useNotificationPermission();

  function toggle(offset) {
    if (value.includes(offset)) {
      onChange(value.filter(v => v !== offset));
      return;
    }
    if (value.length >= MAX_REMINDERS) return;
    onChange([...value, offset].sort((a, b) => a - b));
    if (permission === 'undetermined') requestPermission();
  }

  const full = value.length >= MAX_REMINDERS;
  let warning = null;
  if (value.length > 0 && permission === 'denied') warning = t.permissionDenied;
  if (value.length > 0 && permission === 'unsupported') warning = t.unsupported;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {REMINDER_OPTIONS.map(offset => (
          <Chip
            key={offset}
            label={t.options[offset]}
            icon="bell"
            multiple
            selected={value.includes(offset)}
            onPress={() => toggle(offset)}
          />
        ))}
      </View>
      {full && <Text style={styles.note}>{t.max(MAX_REMINDERS)}</Text>}
      {value.length > 0 && !dueTime && <Text style={styles.note}>{t.untimed(defaultTime)}</Text>}
      {value.length > 0 && Platform.OS === 'web' && !warning && <Text style={styles.note}>{t.webNote}</Text>}
      {warning && <Text style={styles.warning}>{warning}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  note: {
    fontSize: 13,
    color: colors.muted,
    paddingHorizontal: 4,
  },
  warning: {
    fontSize: 13,
    color: colors.danger,
    paddingHorizontal: 4,
  },
});
