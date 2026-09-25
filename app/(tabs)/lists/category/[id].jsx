import React, { useMemo } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTodoStore, isAlive } from '../../../../src/store/useTodoStore';
import { tasksInCategory, splitCompleted } from '../../../../src/domain/filters';
import QuickAdd from '../../../../src/components/QuickAdd';
import TaskRows from '../../../../src/components/TaskRows';
import CompletedSection from '../../../../src/components/CompletedSection';
import EmptyState from '../../../../src/components/EmptyState';
import { colors } from '../../../../src/theme';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const category = useTodoStore(s => s.categories.find(c => c.id === id));
  const allTasks = useTodoStore(s => s.tasks);
  const { open, completed } = useMemo(() => splitCompleted(tasksInCategory(allTasks, id)), [allTasks, id]);
  const defaults = useMemo(() => ({ categoryId: id }), [id]);

  // Kategori silindiyse (ör. düzenleme ekranından) listeye dön.
  if (!category || !isAlive(category)) return <Redirect href="/lists" />;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          title: category.name,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/category-form', params: { id } })}
              accessibilityLabel="Kategoriyi düzenle"
              style={styles.headerButton}
            >
              <Feather name="edit-2" size={18} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <QuickAdd defaults={defaults} placeholder={`${category.name} listesine ekle...`} />
      <TaskRows tasks={open} />
      {open.length === 0 && (
        <EmptyState icon={category.icon} color={category.color} text="Bu kategoride açık görev yok" />
      )}
      <CompletedSection tasks={completed} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  headerButton: {
    padding: 8,
  },
});
