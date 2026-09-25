import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemedStyles, useTheme } from '../theme';

// Listeler ve etiket yönetimi ekranlarındaki satırlar: renkli simge, ad, sayı.
export function ListRow({ icon, color, name, count, first, onPress }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={[styles.row, !first && styles.rowBorder]} onPress={onPress}>
      <View style={[styles.icon, { backgroundColor: color }]}>
        <Feather name={icon} size={16} color={colors.onPrimary} />
      </View>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      {count > 0 && <Text style={styles.count}>{count}</Text>}
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </TouchableOpacity>
  );
}

export function SectionHeader({ title, actionLabel, actionIcon = 'plus', onAction }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onAction && (
        <TouchableOpacity style={styles.action} onPress={onAction} accessibilityLabel={actionLabel}>
          <Feather name={actionIcon} size={16} color={colors.primary} />
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Listeler ve etiket yönetimi ekranlarında ortak kart/boş durum stilleri.
export function useListStyles() {
  return useThemedStyles(makeListStyles);
}

const makeListStyles = colors => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    padding: 16,
    textAlign: 'center',
  },
});

const makeStyles = colors => StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  actionText: {
    color: colors.primary,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  count: {
    fontSize: 13,
    color: colors.muted,
  },
});
