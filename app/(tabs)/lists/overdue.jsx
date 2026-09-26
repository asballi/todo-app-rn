import React, { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTodoStore } from '../../../src/store/useTodoStore';
import { useNow } from '../../../src/store/hooks';
import { overdueTasks } from '../../../src/domain/filters';
import TaskRows from '../../../src/components/TaskRows';
import EmptyState from '../../../src/components/EmptyState';
import { useThemedStyles, useTheme } from '../../../src/theme';
import { strings } from '../../../src/strings';

export default function OverdueScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const now = useNow();
  const allTasks = useTodoStore(s => s.tasks);
  const tasks = useMemo(() => overdueTasks(allTasks, now), [allTasks, now]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TaskRows tasks={tasks} />
      {tasks.length === 0 && <EmptyState icon="check-circle" color={colors.primary} text={strings.lists.overdueEmpty} />}
    </ScrollView>
  );
}

const makeStyles = colors => StyleSheet.create({
  content: {
    padding: 16,
  },
});
