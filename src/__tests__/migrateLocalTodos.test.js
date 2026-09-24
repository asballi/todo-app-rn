import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLocalTodos, LOCAL_TODOS_KEY } from '../migrateLocalTodos';
import { createTodoRepository } from '../todoRepository';
import { createMemoryBackend } from '../testing/memoryBackend';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(() => AsyncStorage.clear());

function saveLocal(todos) {
  return AsyncStorage.setItem(LOCAL_TODOS_KEY, JSON.stringify(todos));
}

function accountView(backend, uid = 'ayse') {
  let latest = [];
  createTodoRepository(backend, uid).subscribe(todos => { latest = todos; });
  return () => latest.map(({ text, done }) => ({ text, done }));
}

test('cihazdaki görevler durumları ve sıraları korunarak hesaba eklenir', async () => {
  const backend = createMemoryBackend();
  const account = accountView(backend);
  await saveLocal([
    { id: 1700000000000, text: 'Süt al', done: true },
    { id: 1700000005000, text: 'Ekmek al', done: false },
  ]);

  await migrateLocalTodos(AsyncStorage, backend, 'ayse');

  expect(account()).toEqual([
    { text: 'Süt al', done: true },
    { text: 'Ekmek al', done: false },
  ]);
});

test('aktarımdan sonra cihazdaki kopya silinir, tekrar çalışınca bir şey eklenmez', async () => {
  const backend = createMemoryBackend();
  const account = accountView(backend);
  await saveLocal([{ id: 1700000000000, text: 'Süt al', done: false }]);

  await migrateLocalTodos(AsyncStorage, backend, 'ayse');
  await migrateLocalTodos(AsyncStorage, backend, 'ayse');

  expect(await AsyncStorage.getItem(LOCAL_TODOS_KEY)).toBeNull();
  expect(account()).toEqual([{ text: 'Süt al', done: false }]);
});

test('hesapta aynı yazılı görev varsa tekrar eklenmez, yeni olanlar eklenir', async () => {
  const backend = createMemoryBackend();
  const account = accountView(backend);
  await createTodoRepository(backend, 'ayse').add('Süt al');
  await saveLocal([
    { id: 1700000000000, text: 'Süt al', done: false },
    { id: 1700000005000, text: 'Çay al', done: false },
  ]);

  await migrateLocalTodos(AsyncStorage, backend, 'ayse');

  expect(account().map(t => t.text).sort()).toEqual(['Süt al', 'Çay al'].sort());
});

test('cihazda aynı yazılı iki görev varsa hesaba bir kez eklenir', async () => {
  const backend = createMemoryBackend();
  const account = accountView(backend);
  await saveLocal([
    { id: 1700000000000, text: 'Süt al', done: false },
    { id: 1700000005000, text: 'Süt al', done: false },
  ]);

  await migrateLocalTodos(AsyncStorage, backend, 'ayse');

  expect(account().map(t => t.text)).toEqual(['Süt al']);
});

test('aktarım yarıda hata verirse cihazdaki görevler silinmez', async () => {
  const backend = createMemoryBackend();
  backend.createTodo = async () => { throw new Error('bağlantı yok'); };
  const local = [{ id: 1700000000000, text: 'Süt al', done: false }];
  await saveLocal(local);

  await expect(migrateLocalTodos(AsyncStorage, backend, 'ayse')).rejects.toThrow();

  expect(JSON.parse(await AsyncStorage.getItem(LOCAL_TODOS_KEY))).toEqual(local);
});

test('cihazda görev yoksa hesaba bir şey eklenmez', async () => {
  const backend = createMemoryBackend();
  const account = accountView(backend);

  await migrateLocalTodos(AsyncStorage, backend, 'ayse');

  expect(account()).toEqual([]);
});
