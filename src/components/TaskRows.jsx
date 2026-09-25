import React from 'react';
import { useRouter } from 'expo-router';
import TaskItem from './TaskItem';
import { showError } from './confirm';
import { useTodoStore } from '../store/useTodoStore';
import { useTagsByTask } from '../store/hooks';

// Görev satırları: dokununca detay açılır, checkbox tamamlar.
export default function TaskRows({ tasks }) {
  const router = useRouter();
  const tagsByTask = useTagsByTask();
  return tasks.map(task => (
    <TaskItem
      key={task.id}
      task={task}
      tags={tagsByTask[task.id]}
      onToggle={() => useTodoStore.getState().toggleTask(task.id).catch(showError)}
      onPress={() => router.push(`/task/${task.id}`)}
    />
  ));
}
