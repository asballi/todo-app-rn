import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTodoStore } from '../../../src/store/useTodoStore';
import { useNow } from '../../../src/store/hooks';
import {
  sortCategories,
  openTaskCountsByCategory,
  sortTags,
  openTaskCountsByTag,
  overdueTasks,
  importantTasks,
} from '../../../src/domain/filters';
import { ListRow, SectionHeader, listStyles } from '../../../src/components/ListRow';
import { colors } from '../../../src/theme';
import { strings } from '../../../src/strings';

const l = strings.lists;

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
  const now = useNow();
  const overdueCount = useMemo(() => overdueTasks(tasks, now).length, [tasks, now]);
  const importantCount = useMemo(() => importantTasks(tasks).length, [tasks]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeader title={l.smartLists} />
      <View style={listStyles.card}>
        <ListRow
          first
          icon="alert-circle"
          color={colors.danger}
          name={l.overdue}
          count={overdueCount}
          onPress={() => router.push('/lists/overdue')}
        />
        <ListRow
          icon="star"
          color={colors.important}
          name={l.important}
          count={importantCount}
          onPress={() => router.push('/lists/important')}
        />
      </View>

      <SectionHeader title={l.categories} actionLabel={l.newCategory} onAction={() => router.push('/category-form')} />
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
        title={l.tags}
        actionLabel={l.manageTags}
        actionIcon="settings"
        onAction={() => router.push('/manage-tags')}
      />
      <View style={listStyles.card}>
        {tags.length === 0 ? (
          <Text style={listStyles.empty}>{l.noTags}</Text>
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
