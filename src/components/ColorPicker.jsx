import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { categoryColors, colors as theme } from '../theme';
import { strings } from '../strings';

// allowNone: "renksiz" seçeneği ekler (value = null).
export default function ColorPicker({ value, onChange, colors = categoryColors, allowNone = false }) {
  return (
    <View style={styles.row}>
      {allowNone && (
        <TouchableOpacity
          accessibilityRole="radio"
          accessibilityLabel={strings.pickers.noColor}
          aria-checked={value == null}
          onPress={() => onChange(null)}
          style={[styles.swatch, styles.none, value == null && styles.noneSelected]}
        >
          <Feather name="slash" size={16} color={value == null ? '#fff' : theme.muted} />
        </TouchableOpacity>
      )}
      {colors.map(color => (
        <TouchableOpacity
          key={color}
          accessibilityRole="radio"
          accessibilityLabel={strings.pickers.colorLabel(color)}
          aria-checked={value === color}
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
  none: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  noneSelected: {
    backgroundColor: theme.tagDefault,
    borderColor: theme.tagDefault,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
