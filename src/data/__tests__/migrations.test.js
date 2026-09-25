import AsyncStorage from '@react-native-async-storage/async-storage';
import { runMigrations, SCHEMA_VERSION } from '../migrations';
import { KEYS, readJson } from '../storage';
import { INBOX_ID } from '../../domain/ids';

beforeEach(() => AsyncStorage.clear());

const NOW = new Date(2026, 8, 25, 12, 0);

test('eski görevleri yeni formata taşır ve eski anahtarı siler', async () => {
  const createdMs = new Date(2026, 0, 15, 9, 30).getTime();
  await AsyncStorage.setItem(
    KEYS.legacyTodos,
    JSON.stringify([
      { id: createdMs, text: 'Eski açık', done: false },
      { id: createdMs + 1, text: 'Eski bitmiş', done: true },
      { id: 3, text: '   ', done: false },
    ]),
  );

  await runMigrations(NOW);

  const tasks = await readJson(KEYS.tasks);
  expect(tasks).toHaveLength(2);
  expect(tasks[0]).toMatchObject({
    title: 'Eski açık',
    categoryId: INBOX_ID,
    completedAt: null,
    createdAt: new Date(createdMs).toISOString(),
  });
  expect(tasks[1]).toMatchObject({ title: 'Eski bitmiş', completedAt: NOW.toISOString() });
  expect(tasks[0].id).toMatch(/^[0-9a-f-]{36}$/);

  const categories = await readJson(KEYS.categories);
  expect(categories).toEqual([expect.objectContaining({ id: INBOX_ID, isSystem: true })]);
  expect(await readJson(KEYS.tags)).toEqual([]);
  expect(await readJson(KEYS.taskTags)).toEqual([]);
  expect(await readJson(KEYS.schemaVersion)).toBe(SCHEMA_VERSION);
  expect(await AsyncStorage.getItem(KEYS.legacyTodos)).toBeNull();
});

test('ilk kurulumda yalnızca Gelen Kutusu oluşturur', async () => {
  await runMigrations(NOW);
  expect(await readJson(KEYS.tasks)).toEqual([]);
  expect(await readJson(KEYS.categories)).toHaveLength(1);
});

test('ikinci çalıştırma veriyi çoğaltmaz', async () => {
  await AsyncStorage.setItem(KEYS.legacyTodos, JSON.stringify([{ id: 1, text: 'a', done: false }]));
  await runMigrations(NOW);
  await runMigrations(NOW);
  expect(await readJson(KEYS.tasks)).toHaveLength(1);
  expect(await readJson(KEYS.categories)).toHaveLength(1);
});

test('sürüm yazıldıktan sonra kalan eski anahtar temizlenir', async () => {
  await runMigrations(NOW);
  await AsyncStorage.setItem(KEYS.legacyTodos, JSON.stringify([{ id: 1, text: 'a', done: false }]));
  await runMigrations(NOW);
  expect(await AsyncStorage.getItem(KEYS.legacyTodos)).toBeNull();
  expect(await readJson(KEYS.tasks)).toEqual([]);
});

test('okunamayan eski veri silinmez ve hata verilir', async () => {
  await AsyncStorage.setItem(KEYS.legacyTodos, '{bozuk');
  await expect(runMigrations(NOW)).rejects.toThrow('Eski görevler okunamadı');
  expect(await AsyncStorage.getItem(KEYS.legacyTodos)).toBe('{bozuk');
  expect(await AsyncStorage.getItem(KEYS.schemaVersion)).toBeNull();
});
