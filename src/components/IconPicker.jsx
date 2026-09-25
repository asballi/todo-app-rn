import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { categoryIcons, useThemedStyles, useTheme } from '../theme';
import { strings } from '../strings';

export default function IconPicker({ value, onChange, color: colorProp }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  // Varsayılan renk temadan gelir (parametre varsayılanı gövdedeki değişkeni göremez).
  const color = colorProp ?? colors.primary;
  return (
    <View style={styles.row}>
      {categoryIcons.map(icon => {
        const selected = value === icon;
        return (
          <TouchableOpacity
            key={icon}
            accessibilityRole="radio"
            accessibilityLabel={strings.pickers.iconLabel(icon)}
            aria-checked={selected}
            onPress={() => onChange(icon)}
            style={[styles.cell, selected && { backgroundColor: color, borderColor: color }]}
          >
            <Feather name={icon} size={18} color={selected ? colors.onPrimary : colors.text} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
