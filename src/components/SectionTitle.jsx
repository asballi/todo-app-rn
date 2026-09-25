import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme';

// Görev listelerindeki bölüm başlığı (ör. "Gecikmiş", "Yarın · 26 Eylül").
export default function SectionTitle({ title, subtitle, count, color = colors.text, onAdd, addLabel }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color }]}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {count > 0 && <Text style={styles.subtitle}>{count}</Text>}
      <View style={styles.spacer} />
      {onAdd && (
        <TouchableOpacity onPress={onAdd} accessibilityLabel={addLabel} hitSlop={8} style={styles.add}>
          <Feather name="plus" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  spacer: {
    flex: 1,
  },
  add: {
    padding: 2,
  },
});
