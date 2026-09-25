import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTodoStore } from '../../../src/store/useTodoStore';
import { sortCategories, openTaskCountsByCategory } from '../../../src/domain/filters';
import { colors } from '../../../src/theme';

export default function ListsScreen() {
  const router = useRouter();
  const allCategories = useTodoStore(s => s.categories);
  const tasks = useTodoStore(s => s.tasks);
  const categories = useMemo(() => sortCategories(allCategories), [allCategories]);
  const counts = useMemo(() => openTaskCountsByCategory(tasks), [tasks]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Kategoriler</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/category-form')}
          accessibilityLabel="Yeni kategori"
        >
          <Feather name="plus" size={16} color={colors.primary} />
          <Text style={styles.addText}>Yeni</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {categories.map((category, index) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.row, index > 0 && styles.rowBorder]}
            onPress={() => router.push(`/lists/category/${category.id}`)}
          >
            <View style={[styles.icon, { backgroundColor: category.color }]}>
              <Feather name={category.icon} size={16} color="#fff" />
            </View>
            <Text style={styles.name} numberOfLines={1}>{category.name}</Text>
            {counts[category.id] > 0 && <Text style={styles.count}>{counts[category.id]}</Text>}
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  addText: {
    color: colors.primary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  count: {
    fontSize: 13,
    color: colors.muted,
  },
});
