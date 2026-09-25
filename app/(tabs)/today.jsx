import React, { useMemo } from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import { useTodoStore } from '../../src/store/useTodoStore';
import { useNow } from '../../src/store/hooks';
import { todayView } from '../../src/domain/filters';
import { toDateKey, formatLongDate } from '../../src/domain/dates';
import QuickAdd from '../../src/components/QuickAdd';
import TaskRows from '../../src/components/TaskRows';
import SectionTitle from '../../src/components/SectionTitle';
import CompletedSection from '../../src/components/CompletedSection';
import EmptyState from '../../src/components/EmptyState';
import { colors } from '../../src/theme';
import { strings } from '../../src/strings';

export default function TodayScreen() {
  const now = useNow();
  const tasks = useTodoStore(s => s.tasks);
  const view = useMemo(() => todayView(tasks, now), [tasks, now]);
  const today = toDateKey(now);
  const defaults = useMemo(() => ({ dueDate: today }), [today]);
  const hasOverdue = view.overdue.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.date}>{formatLongDate(now)}</Text>
      <QuickAdd defaults={defaults} placeholder={strings.today.quickAdd} />

      {hasOverdue && (
        <>
          <SectionTitle title={strings.today.overdue} color={colors.danger} count={view.overdue.length} />
          <TaskRows tasks={view.overdue} />
          <SectionTitle title={strings.today.today} count={view.today.length} />
          {view.today.length === 0 && <Text style={styles.none}>{strings.common.none}</Text>}
        </>
      )}
      <TaskRows tasks={view.today} />

      {!hasOverdue && view.today.length === 0 && (
        <EmptyState icon="sun" text={strings.today.empty} />
      )}

      <CompletedSection tasks={view.completed} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  none: {
    fontSize: 13,
    color: '#bbb',
    paddingHorizontal: 4,
  },
  date: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
});
