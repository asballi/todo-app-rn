import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  schemaVersion: '@todo/schemaVersion',
  tasks: '@todo/tasks',
  categories: '@todo/categories',
  tags: '@todo/tags',
  taskTags: '@todo/taskTags',
  legacyTodos: '@todos',
};

export async function readJson(key, fallback) {
  const json = await AsyncStorage.getItem(key);
  return json == null ? fallback : JSON.parse(json);
}

// Birden fazla anahtarı tek çağrıda yazar: [[key, value], ...]
export async function writeJsonMany(entries) {
  await AsyncStorage.multiSet(entries.map(([key, value]) => [key, JSON.stringify(value)]));
}

export async function removeKey(key) {
  await AsyncStorage.removeItem(key);
}

// Aynı anahtara yapılan oku-değiştir-yaz işlemlerini sıraya koyar; aksi halde
// arka arkaya gelen iki değişiklikten biri kaybolabilir.
const queues = new Map();

export function withKeyLock(key, fn) {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(key, next.catch(() => {}));
  return next;
}
