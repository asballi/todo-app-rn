import AsyncStorage from '@react-native-async-storage/async-storage';
import { taskRepository } from '../repositories';

beforeEach(() => AsyncStorage.clear());

test('upsertMany ekler ve ID ile günceller', async () => {
  await taskRepository.upsertMany([{ id: 'a', title: '1' }, { id: 'b', title: '2' }]);
  await taskRepository.upsertMany([{ id: 'a', title: '1b' }]);
  expect(await taskRepository.list()).toEqual([
    { id: 'a', title: '1b' },
    { id: 'b', title: '2' },
  ]);
});

test('eşzamanlı yazmalarda değişiklik kaybolmaz', async () => {
  await Promise.all(
    Array.from({ length: 20 }, (_, i) => taskRepository.upsertMany([{ id: String(i) }])),
  );
  expect(await taskRepository.list()).toHaveLength(20);
});
