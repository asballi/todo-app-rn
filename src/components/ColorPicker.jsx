import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { categoryColors } from '../theme';

export default function ColorPicker({ value, onChange, colors = categoryColors }) {
  return (
    <View style={styles.row}>
      {colors.map(color => (
        <TouchableOpacity
          key={color}
          accessibilityRole="radio"
          accessibilityLabel={`Renk ${color}`}
          accessibilityState={{ selected: value === color }}
          onPress={() => onChange(color)}
          style={[styles.swatch, { backgroundColor: color }]}
        >
          {value === color && <Feather name="check" size={16} color="#fff" />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
