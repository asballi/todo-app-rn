import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTodoStore } from '../../../src/store/useTodoStore';
import {
  sortCategories,
  openTaskCountsByCategory,
  sortTags,
  openTaskCountsByTag,
} from '../../../src/domain/filters';
import { ListRow, SectionHeader, listStyles } from '../../../src/components/ListRow';
import { colors } from '../../../src/theme';

export default function ListsScreen() {
  const router = useRouter();
  const allCategories = useTodoStore(s => s.categories);
  const allTags = useTodoStore(s => s.tags);
  const tasks = useTodoStore(s => s.tasks);
  const taskTags = useTodoStore(s => s.taskTags);

  const categories = useMemo(() => sortCategories(allCategories), [allCategories]);
  const tags = useMemo(() => sortTags(allTags), [allTags]);
  const categoryCounts = useMemo(() => openTaskCountsByCategory(tasks), [tasks]);
  const tagCounts = useMemo(() => openTaskCountsByTag(tasks, taskTags), [tasks, taskTags]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeader title="Kategoriler" actionLabel="Yeni kategori" onAction={() => router.push('/category-form')} />
      <View style={listStyles.card}>
        {categories.map((category, index) => (
          <ListRow
            key={category.id}
            first={index === 0}
            icon={category.icon}
            color={category.color}
            name={category.name}
            count={categoryCounts[category.id]}
            onPress={() => router.push(`/lists/category/${category.id}`)}
          />
        ))}
      </View>

      <SectionHeader
        title="Etiketler"
        actionLabel="Etiketleri yönet"
        actionIcon="settings"
        onAction={() => router.push('/manage-tags')}
      />
      <View style={listStyles.card}>
        {tags.length === 0 ? (
          <Text style={listStyles.empty}>
            Henüz etiket yok. Görev düzenlerken etiket ekleyebilirsin.
          </Text>
        ) : (
          tags.map((tag, index) => (
            <ListRow
              key={tag.id}
              first={index === 0}
              icon="hash"
              color={tag.color ?? colors.tagDefault}
              name={tag.name}
              count={tagCounts[tag.id]}
              onPress={() => router.push(`/lists/tag/${tag.id}`)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
});
