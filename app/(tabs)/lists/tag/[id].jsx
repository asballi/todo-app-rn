import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTodoStore, isAlive } from '../../../../src/store/useTodoStore';
import { useTagsByTask } from '../../../../src/store/hooks';
import { tasksWithTag } from '../../../../src/domain/filters';
import TaskItem from '../../../../src/components/TaskItem';
import QuickAdd from '../../../../src/components/QuickAdd';
import { showError } from '../../../../src/components/confirm';
import { colors } from '../../../../src/theme';

export default function TagScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const tag = useTodoStore(s => s.tags.find(t => t.id === id));
  const allTasks = useTodoStore(s => s.tasks);
  const taskTags = useTodoStore(s => s.taskTags);
  const tagsByTask = useTagsByTask();
  const tasks = useMemo(() => tasksWithTag(allTasks, taskTags, id), [allTasks, taskTags, id]);
  const defaults = useMemo(() => ({ tagIds: [id] }), [id]);

  // Etiket silindiyse (ör. düzenleme ekranından) listeye dön.
  if (!tag || !isAlive(tag)) return <Redirect href="/lists" />;
  const color = tag.color ?? colors.tagDefault;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `#${tag.name}`,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/tag-form', params: { id } })}
              accessibilityLabel="Etiketi düzenle"
              style={styles.headerButton}
            >
              <Feather name="edit-2" size={18} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <QuickAdd defaults={defaults} placeholder={`#${tag.name} etiketiyle ekle...`} />
      <FlatList
        data={tasks}
        keyExtractor={t => t.id}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            tags={tagsByTask[item.id]}
            onToggle={() => useTodoStore.getState().toggleTask(item.id).catch(showError)}
            onPress={() => router.push(`/task/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="hash" size={32} color={color} />
            <Text style={styles.emptyText}>Bu etiketle görev yok</Text>
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
