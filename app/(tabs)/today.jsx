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
      <QuickAdd defaults={defaults} placeholder="Bugün için görev ekle..." />

      {hasOverdue && (
        <>
          <SectionTitle title="Gecikmiş" color={colors.danger} count={view.overdue.length} />
          <TaskRows tasks={view.overdue} />
          <SectionTitle title="Bugün" count={view.today.length} />
          {view.today.length === 0 && <Text style={styles.none}>Görev yok</Text>}
        </>
      )}
      <TaskRows tasks={view.today} />

      {!hasOverdue && view.today.length === 0 && (
        <EmptyState icon="sun" text="Bugün için görev yok" />
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
