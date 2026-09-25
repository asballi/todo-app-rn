import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { onColor, useThemedStyles, useTheme } from '../theme';

// `selected` verilirse seçim çipidir (tekli seçimde radio, `multiple` ile
// checkbox), verilmezse eylem butonudur.
export default function Chip({ label, icon, selected, multiple, color: colorProp, onPress, accessibilityLabel }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  // Varsayılan renk temadan gelir (parametre varsayılanı gövdedeki değişkeni göremez).
  const color = colorProp ?? colors.primary;
  // Seçili çipin zemini kullanıcı rengi olabilir; üstündeki yazı okunaklı kalsın.
  const onSelected = colorProp ? onColor(colorProp) : colors.onPrimary;
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
      {icon && <Feather name={icon} size={14} color={selected ? onSelected : color} />}
      <Text style={[styles.label, selected && styles.labelSelected, selected && { color: onSelected }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = colors => StyleSheet.create({
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
    fontWeight: '600',
  },
});
