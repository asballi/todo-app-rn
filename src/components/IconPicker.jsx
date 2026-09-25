import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, categoryIcons } from '../theme';

export default function IconPicker({ value, onChange, color = colors.primary }) {
  return (
    <View style={styles.row}>
      {categoryIcons.map(icon => {
        const selected = value === icon;
        return (
          <TouchableOpacity
            key={icon}
            accessibilityRole="radio"
            accessibilityLabel={`Simge ${icon}`}
            aria-checked={selected}
            onPress={() => onChange(icon)}
            style={[styles.cell, selected && { backgroundColor: color, borderColor: color }]}
          >
            <Feather name={icon} size={18} color={selected ? '#fff' : colors.text} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
