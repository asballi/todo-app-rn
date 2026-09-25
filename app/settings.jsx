import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import DateInput from '../src/components/DateInput';
import Chip from '../src/components/Chip';
import { confirm, showError } from '../src/components/confirm';
import { saveBackupFile, pickBackupFile } from '../src/data/backupFile';
import { backupFileName } from '../src/data/backup';
import { useTodoStore, THEME_MODES } from '../src/store/useTodoStore';
import { useNotificationPermission } from '../src/notifications/useReminders';
import { strings } from '../src/strings';
import { useThemedStyles } from '../src/theme';

const t = strings.settings;
const THEME_ICONS = { system: 'smartphone', light: 'sun', dark: 'moon' };

async function exportBackup() {
  try {
    const backup = useTodoStore.getState().exportBackup();
    await saveBackupFile(backupFileName(), JSON.stringify(backup, null, 2));
  } catch (e) {
    showError(e);
  }
}

// Dosya seçilir, doğrulanır, özet onaylanınca birleştirilir (geri alınabilir).
async function importBackup() {
  try {
    const text = await pickBackupFile();
    if (text == null) return;
    const store = useTodoStore.getState();
    const preview = store.previewImport(text);
    if (!preview.hasChanges) {
      showError(new Error(strings.backup.nothingToImport));
      return;
    }
    const ok = await confirm({
      title: strings.backup.confirmTitle,
      message: strings.backup.summary(preview.summary),
      confirmText: strings.backup.confirm,
    });
    if (ok) await store.importBackup(preview);
  } catch (e) {
    showError(e);
  }
}

export default function SettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const defaultReminderTime = useTodoStore(s => s.settings.defaultReminderTime);
  const theme = useTodoStore(s => s.settings.theme ?? 'system');
  const [permission, requestPermission] = useNotificationPermission();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t.title }} />

      <Text style={styles.label}>{t.theme}</Text>
      <View style={styles.card}>
        <View style={styles.buttons} accessibilityRole="radiogroup" accessibilityLabel={t.theme}>
          {THEME_MODES.map(mode => (
            <Chip
              key={mode}
              label={t.themeModes[mode]}
              icon={THEME_ICONS[mode]}
              selected={theme === mode}
              onPress={() => useTodoStore.getState().updateSettings({ theme: mode }).catch(showError)}
            />
          ))}
        </View>
        <Text style={styles.help}>{t.themeHelp}</Text>
      </View>

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

      <Text style={styles.label}>{strings.backup.title}</Text>
      <View style={styles.card}>
        <Text style={styles.help}>{strings.backup.help}</Text>
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.button} onPress={exportBackup}>
            <Text style={styles.buttonText}>{strings.backup.export}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={importBackup}>
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>{strings.backup.import}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = colors => StyleSheet.create({
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
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
  },
  buttonText: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
