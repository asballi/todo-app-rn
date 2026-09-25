import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import TaskForm from '../../src/components/TaskForm';
import { showError } from '../../src/components/confirm';
import { goBack } from '../../src/components/navigation';
import { useTodoStore, isAlive } from '../../src/store/useTodoStore';
import { colors } from '../../src/theme';
import { strings } from '../../src/strings';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // Açılıştaki hali kullanılır; silme/tamamlama sonrası form sıfırlanmaz.
  const [task] = useState(() => {
    const { tasks, taskTags } = useTodoStore.getState();
    const found = tasks.find(t => t.id === id);
    if (!found || !isAlive(found)) return null;
    const tagIds = taskTags.filter(l => l.taskId === id && isAlive(l)).map(l => l.tagId);
    return { ...found, tagIds };
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

  // Onay sorulmaz; liste ekranında "Geri al" şeridi çıkar.
  function remove() {
    run(() => useTodoStore.getState().deleteTasks([id]));
  }

  return (
    <>
      <Stack.Screen options={{ title: strings.task.detailTitle }} />
      <TaskForm
        initial={task}
        submitLabel={strings.common.save}
        onSubmit={values => run(() => useTodoStore.getState().updateTask(id, values))}
      >
        <TouchableOpacity style={styles.action} onPress={() => run(() => useTodoStore.getState().toggleTask(id))}>
          <Feather name={done ? 'rotate-ccw' : 'check-circle'} size={16} color={colors.primary} />
          <Text style={styles.actionText}>
            {done ? strings.task.markUndone : strings.task.markDone}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={remove}>
          <Feather name="trash-2" size={16} color={colors.danger} />
          <Text style={[styles.actionText, { color: colors.danger }]}>{strings.task.delete}</Text>
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
