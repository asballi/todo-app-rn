import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReminderBanner } from '../notifications/bannerStore';
import { strings } from '../strings';
import { useThemedStyles, useTheme } from '../theme';

const t = strings.reminders;

// Uygulama içi hatırlatıcı şeritleri: dokununca görev açılır. Kendiliğinden
// kapanmaz; kullanıcı bakmıyorken hatırlatıcı kaybolmasın.
export default function ReminderBanner() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const items = useReminderBanner(s => s.items);
  const dismiss = useReminderBanner(s => s.dismiss);
  const insets = useSafeAreaInsets();

  if (items.length === 0) return null;

  return (
    <View style={[styles.container, { top: insets.top + 12 }]} pointerEvents="box-none">
      {items.map(item => (
        <View key={item.key} style={styles.banner} accessibilityRole="alert">
          <TouchableOpacity
            style={styles.body}
            onPress={() => {
              dismiss(item.key);
              router.push(`/task/${item.taskId}`);
            }}
            accessibilityLabel={t.bannerOpen(item.title)}
          >
            <Feather name="bell" size={18} color={colors.onPrimary} />
            <View style={styles.texts}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.body}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => dismiss(item.key)} accessibilityLabel={t.bannerDismiss} hitSlop={8}>
            <Feather name="x" size={18} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 10,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  texts: {
    flex: 1,
  },
  title: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.onPrimary,
    opacity: 0.85,
    fontSize: 13,
  },
});
