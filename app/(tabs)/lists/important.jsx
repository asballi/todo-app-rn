import React, { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTodoStore } from '../../../src/store/useTodoStore';
import { importantTasks } from '../../../src/domain/filters';
import TaskRows from '../../../src/components/TaskRows';
import EmptyState from '../../../src/components/EmptyState';
import { useThemedStyles, useTheme } from '../../../src/theme';
import { strings } from '../../../src/strings';

// Önemli: yüksek öncelikli, tamamlanmamış görevler.
export default function ImportantScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const allTasks = useTodoStore(s => s.tasks);
  const tasks = useMemo(() => importantTasks(allTasks), [allTasks]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TaskRows tasks={tasks} />
      {tasks.length === 0 && (
        <EmptyState icon="star" color={colors.important} text={strings.lists.importantEmpty} />
      )}
    </ScrollView>
  );
}

const makeStyles = colors => StyleSheet.create({
  content: {
    padding: 16,
  },
});
