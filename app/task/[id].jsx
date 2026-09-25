import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import TaskForm from '../../src/components/TaskForm';
import { confirm, showError } from '../../src/components/confirm';
import { goBack } from '../../src/components/navigation';
import { useTodoStore, isAlive } from '../../src/store/useTodoStore';
import { colors } from '../../src/theme';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // Açılıştaki hali kullanılır; silme/tamamlama sonrası form sıfırlanmaz.
  const [task] = useState(() => {
    const found = useTodoStore.getState().tasks.find(t => t.id === id);
    return found && isAlive(found) ? found : null;
  });

  if (!task) return <Redirect href="/today" />;

  const close = () => goBack(router, '/today');
  const done = !!task.completedAt;

  async function run(action) {
    try {
      await action();
      close();
    } catch (e) {
      showError(e);
    }
  }

  async function remove() {
    const ok = await confirm({ title: `"${task.title}" silinsin mi?`, confirmText: 'Sil', destructive: true });
    if (ok) run(() => useTodoStore.getState().deleteTasks([id]));
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Görev' }} />
      <TaskForm
        initial={task}
        submitLabel="Kaydet"
        onSubmit={values => run(() => useTodoStore.getState().updateTask(id, values))}
      >
        <TouchableOpacity style={styles.action} onPress={() => run(() => useTodoStore.getState().toggleTask(id))}>
          <Feather name={done ? 'rotate-ccw' : 'check-circle'} size={16} color={colors.primary} />
          <Text style={styles.actionText}>
            {done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={remove}>
          <Feather name="trash-2" size={16} color={colors.danger} />
          <Text style={[styles.actionText, { color: colors.danger }]}>Görevi sil</Text>
        </TouchableOpacity>
      </TaskForm>
    </>
  );
}

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  actionText: {
    color: colors.primary,
    fontWeight: '600',
  },
});
