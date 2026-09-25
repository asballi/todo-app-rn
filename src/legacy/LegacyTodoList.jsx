import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../theme';
import { useTodoStore, liveRecords } from '../store/useTodoStore';
import { useTagsByTask } from '../store/hooks';
import { sortTasks } from '../domain/sorting';
import TaskItem from '../components/TaskItem';
import QuickAdd from '../components/QuickAdd';
import { showError } from '../components/confirm';

// Geçici: v1 planının 6. adımında Bugün akıllı listesiyle değiştirilecek.

const FILTERS = ['Tümü', 'Aktif', 'Tamamlanan'];

export default function LegacyTodoList() {
  const router = useRouter();
  const allTasks = useTodoStore(s => s.tasks);
  const tagsByTask = useTagsByTask();
  const todos = useMemo(() => sortTasks(liveRecords(allTasks)), [allTasks]);
  const [filter, setFilter] = useState('Tümü');

  const visibleTodos = todos.filter(t => {
    if (filter === 'Aktif') return !t.completedAt;
    if (filter === 'Tamamlanan') return !!t.completedAt;
    return true;
  });
  const remaining = todos.filter(t => !t.completedAt).length;

  function clearDone() {
    const ids = todos.filter(t => t.completedAt).map(t => t.id);
    useTodoStore.getState().deleteTasks(ids).catch(showError);
  }

  return (
    <View style={styles.container}>
      <QuickAdd />

      <View style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={visibleTodos}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            tags={tagsByTask[item.id]}
            onToggle={() => useTodoStore.getState().toggleTask(item.id).catch(showError)}
            onPress={() => router.push(`/task/${item.id}`)}
          />
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Görev yok</Text>}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>{remaining} görev kaldı</Text>
        <TouchableOpacity onPress={clearDone}>
          <Text style={styles.clearBtn}>Tamamlananları sil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
  },
  filters: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  emptyText: {
    color: '#bbb',
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 40,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: 12,
    color: colors.muted,
  },
  clearBtn: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '500',
  },
});
