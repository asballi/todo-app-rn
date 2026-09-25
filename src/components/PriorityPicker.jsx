import React from 'react';
import { View, StyleSheet } from 'react-native';
import Chip from './Chip';
import { priorityColors } from '../theme';

const LABELS = ['Yok', 'Düşük', 'Orta', 'Yüksek'];

export default function PriorityPicker({ value, onChange }) {
  return (
    <View style={styles.row}>
      {LABELS.map((label, priority) => (
        <Chip
          key={label}
          label={label}
          icon="flag"
          color={priorityColors[priority]}
          selected={value === priority}
          onPress={() => onChange(priority)}
          accessibilityLabel={`Öncelik ${label}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
