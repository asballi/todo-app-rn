import React, { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTodoStore } from '../../../src/store/useTodoStore';
import { useNow } from '../../../src/store/hooks';
import { overdueTasks } from '../../../src/domain/filters';
import TaskRows from '../../../src/components/TaskRows';
import EmptyState from '../../../src/components/EmptyState';
import { colors } from '../../../src/theme';

export default function OverdueScreen() {
  const now = useNow();
  const allTasks = useTodoStore(s => s.tasks);
  const tasks = useMemo(() => overdueTasks(allTasks, now), [allTasks, now]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TaskRows tasks={tasks} />
      {tasks.length === 0 && <EmptyState icon="check-circle" color={colors.primary} text="Gecikmiş görev yok" />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
});
