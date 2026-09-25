import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Chip from './Chip';
import { useTodoStore } from '../store/useTodoStore';
import { sortCategories } from '../domain/filters';

export default function CategoryPicker({ value, onChange }) {
  const allCategories = useTodoStore(s => s.categories);
  const categories = useMemo(() => sortCategories(allCategories), [allCategories]);

  return (
    <View style={styles.row}>
      {categories.map(category => (
        <Chip
          key={category.id}
          label={category.name}
          icon={category.icon}
          color={category.color}
          selected={value === category.id}
          onPress={() => onChange(category.id)}
          accessibilityLabel={`Kategori ${category.name}`}
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
