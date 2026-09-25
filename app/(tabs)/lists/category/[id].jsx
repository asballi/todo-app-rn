import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTodoStore, isAlive } from '../../../../src/store/useTodoStore';
import { tasksInCategory } from '../../../../src/domain/filters';
import TaskItem from '../../../../src/components/TaskItem';
import QuickAdd from '../../../../src/components/QuickAdd';
import { showError } from '../../../../src/components/confirm';
import { colors } from '../../../../src/theme';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const category = useTodoStore(s => s.categories.find(c => c.id === id));
  const allTasks = useTodoStore(s => s.tasks);
  const tasks = useMemo(() => tasksInCategory(allTasks, id), [allTasks, id]);
  const defaults = useMemo(() => ({ categoryId: id }), [id]);

  // Kategori silindiyse (ör. düzenleme ekranından) listeye dön.
  if (!category || !isAlive(category)) return <Redirect href="/lists" />;

  return (
    <View style={styles.container}>
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
      <FlatList
        data={tasks}
        keyExtractor={t => t.id}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            onToggle={() => useTodoStore.getState().toggleTask(item.id).catch(showError)}
            onPress={() => router.push(`/task/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name={category.icon} size={32} color={category.color} />
            <Text style={styles.emptyText}>Bu kategoride görev yok</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerButton: {
    padding: 8,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },
});
