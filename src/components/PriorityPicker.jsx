import React from 'react';
import { View, StyleSheet } from 'react-native';
import Chip from './Chip';
import { priorityColors, useThemedStyles } from '../theme';
import { strings } from '../strings';

export const PRIORITY_LABELS = strings.priority.labels;

export default function PriorityPicker({ value, onChange }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      {PRIORITY_LABELS.map((label, priority) => (
        <Chip
          key={label}
          label={label}
          icon="flag"
          color={priorityColors[priority]}
          selected={value === priority}
          onPress={() => onChange(priority)}
          accessibilityLabel={strings.priority.chipLabel(label)}
        />
      ))}
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
