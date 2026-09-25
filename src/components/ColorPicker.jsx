import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { categoryColors, useThemedStyles, useTheme } from '../theme';
import { strings } from '../strings';

// allowNone: "renksiz" seçeneği ekler (value = null).
export default function ColorPicker({ value, onChange, palette = categoryColors, allowNone = false }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
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
          <Feather name="slash" size={16} color={value == null ? colors.onPrimary : colors.muted} />
        </TouchableOpacity>
      )}
      {palette.map(color => (
        <TouchableOpacity
          key={color}
          accessibilityRole="radio"
          accessibilityLabel={strings.pickers.colorLabel(color)}
          aria-checked={value === color}
          onPress={() => onChange(color)}
          style={[styles.swatch, { backgroundColor: color }]}
        >
          {value === color && <Feather name="check" size={16} color={colors.onPrimary} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  none: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  noneSelected: {
    backgroundColor: colors.tagDefault,
    borderColor: colors.tagDefault,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
