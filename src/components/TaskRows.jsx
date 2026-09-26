import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import TaskItem from './TaskItem';
import SwipeableRow from './SwipeableRow';
import { showError } from './confirm';
import { useTodoStore } from '../store/useTodoStore';
import { useTagsByTask } from '../store/hooks';

// Görev satırları: dokununca detay açılır, checkbox tamamlar. Mobilde sağa
// kaydırma tamamlar, sola kaydırma siler; web'de üzerine gelince sil butonu.
// Silme onay sormaz, geri alma şeridiyle geri alınır (plan A).
export default function TaskRows({ tasks }) {
  const tagsByTask = useTagsByTask();
  return tasks.map(task => <TaskRow key={task.id} task={task} tags={tagsByTask[task.id]} />);
}

function TaskRow({ task, tags }) {
  const router = useRouter();
  const id = task.id;
  const toggle = useCallback(() => useTodoStore.getState().toggleTask(id).catch(showError), [id]);
  const remove = useCallback(() => useTodoStore.getState().deleteTasks([id]).catch(showError), [id]);
  return (
    <SwipeableRow title={task.title} done={!!task.completedAt} onComplete={toggle} onDelete={remove} testID={`swipe-${id}`}>
      {({ trailing, ...rowProps }) => (
        <TaskItem
          task={task}
          tags={tags}
          onToggle={toggle}
          onPress={() => router.push(`/task/${id}`)}
          trailing={trailing}
          rowProps={rowProps}
        />
      )}
    </SwipeableRow>
  );
}
