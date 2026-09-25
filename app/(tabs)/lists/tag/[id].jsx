import React, { useMemo } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTodoStore, isAlive } from '../../../../src/store/useTodoStore';
import { tasksWithTag, splitCompleted } from '../../../../src/domain/filters';
import QuickAdd from '../../../../src/components/QuickAdd';
import TaskRows from '../../../../src/components/TaskRows';
import CompletedSection from '../../../../src/components/CompletedSection';
import EmptyState from '../../../../src/components/EmptyState';
import { colors } from '../../../../src/theme';
import { strings } from '../../../../src/strings';

export default function TagScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const tag = useTodoStore(s => s.tags.find(t => t.id === id));
  const allTasks = useTodoStore(s => s.tasks);
  const taskTags = useTodoStore(s => s.taskTags);
  const { open, completed } = useMemo(
    () => splitCompleted(tasksWithTag(allTasks, taskTags, id)),
    [allTasks, taskTags, id],
  );
  const defaults = useMemo(() => ({ tagIds: [id] }), [id]);

  // Etiket silindiyse (ör. düzenleme ekranından) listeye dön.
  if (!tag || !isAlive(tag)) return <Redirect href="/lists" />;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          title: `#${tag.name}`,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/tag-form', params: { id } })}
              accessibilityLabel={strings.tag.edit}
              style={styles.headerButton}
            >
              <Feather name="edit-2" size={18} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <QuickAdd defaults={defaults} placeholder={strings.tag.quickAdd(tag.name)} />
      <TaskRows tasks={open} />
      {open.length === 0 && (
        <EmptyState icon="hash" color={tag.color ?? colors.tagDefault} text={strings.tag.empty} />
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
