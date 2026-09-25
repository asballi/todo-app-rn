import React, { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import TaskForm from '../../src/components/TaskForm';
import { showError } from '../../src/components/confirm';
import { goBack } from '../../src/components/navigation';
import { useTodoStore, isAlive } from '../../src/store/useTodoStore';
import { INBOX_ID } from '../../src/domain/ids';
import { isValidDateKey } from '../../src/domain/dates';

// Parametreler (hepsi isteğe bağlı): title, categoryId, dueDate.
// Hızlı ekleme satırı bulunduğu ekranın varsayılanlarını buraya aktarır.
export default function NewTaskScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const [initial] = useState(() => {
    const category = useTodoStore.getState().categories.find(c => c.id === params.categoryId);
    return {
      title: params.title ?? '',
      notes: '',
      categoryId: category && isAlive(category) ? category.id : INBOX_ID,
      dueDate: isValidDateKey(params.dueDate) ? params.dueDate : null,
      dueTime: null,
      priority: 0,
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
      <Stack.Screen options={{ title: 'Yeni görev' }} />
      <TaskForm initial={initial} submitLabel="Oluştur" onSubmit={create} autoFocus />
    </>
  );
}
