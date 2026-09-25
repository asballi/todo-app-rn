import React, { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import TaskForm from '../../src/components/TaskForm';
import { showError } from '../../src/components/confirm';
import { goBack } from '../../src/components/navigation';
import { useTodoStore, isAlive } from '../../src/store/useTodoStore';
import { INBOX_ID } from '../../src/domain/ids';
import { isValidDateKey } from '../../src/domain/dates';
import { strings } from '../../src/strings';

// Parametreler (hepsi isteğe bağlı): title, categoryId, dueDate,
// tagIds (virgülle ayrılmış).
// Hızlı ekleme satırı bulunduğu ekranın varsayılanlarını buraya aktarır.
export default function NewTaskScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const [initial] = useState(() => {
    const { categories, tags } = useTodoStore.getState();
    const category = categories.find(c => c.id === params.categoryId);
    const requestedTagIds = (params.tagIds ?? '').split(',');
    return {
      title: params.title ?? '',
      notes: '',
      categoryId: category && isAlive(category) ? category.id : INBOX_ID,
      dueDate: isValidDateKey(params.dueDate) ? params.dueDate : null,
      dueTime: null,
      priority: 0,
      tagIds: tags.filter(t => isAlive(t) && requestedTagIds.includes(t.id)).map(t => t.id),
    };
  });

  async function create(values) {
    try {
      await useTodoStore.getState().addTask(values);
      goBack(router, '/today');
    } catch (e) {
      showError(e);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: strings.task.newTitle }} />
      <TaskForm initial={initial} submitLabel={strings.common.create} onSubmit={create} autoFocus />
    </>
  );
}
