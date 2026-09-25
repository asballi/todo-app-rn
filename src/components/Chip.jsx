import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme';

// `selected` verilirse seçim çipidir (tekli seçimde radio, `multiple` ile
// checkbox), verilmezse eylem butonudur.
export default function Chip({ label, icon, selected, multiple, color = colors.primary, onPress, accessibilityLabel }) {
  const selectable = selected !== undefined;
  const role = selectable ? (multiple ? 'checkbox' : 'radio') : 'button';
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      aria-checked={selectable ? !!selected : undefined}
      style={[styles.chip, selected && { backgroundColor: color, borderColor: color }]}
    >
      {icon && <Feather name={icon} size={14} color={selected ? '#fff' : color} />}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: 13,
    color: colors.text,
  },
  labelSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
