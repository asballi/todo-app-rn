import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncQueue } from '../queue';
import { KEYS, readJson } from '../../data/storage';

beforeEach(async () => {
  await AsyncStorage.clear();
  await syncQueue.load();
});

const task = id => ({ id });

test('etkin değilken bir şey tutmaz', async () => {
  await syncQueue.enqueue({ tasks: [task('a')] });
  expect(syncQueue.size()).toBe(0);
  expect(await readJson(KEYS.syncQueue, null)).toBeNull();
});

test('etkinken kimlikleri tutar, depoya yazar ve yeniden yükler', async () => {
  await syncQueue.activate();
  await syncQueue.enqueue({ tasks: [task('a'), task('b')], taskTags: [task('l')] });
  expect(syncQueue.has('tasks', 'a')).toBe(true);
  expect(syncQueue.has('tags', 'a')).toBe(false);
  expect(syncQueue.snapshot()).toEqual([
    { collection: 'tasks', id: 'a', seq: 1 },
    { collection: 'tasks', id: 'b', seq: 2 },
    { collection: 'taskTags', id: 'l', seq: 3 },
  ]);

  await syncQueue.load();
  expect(syncQueue.isActive()).toBe(true);
  expect(syncQueue.size()).toBe(3);
});

test('ack gönderim sırasında yeniden değişen kaydı çıkarmaz', async () => {
  await syncQueue.activate();
  await syncQueue.enqueue({ tasks: [task('a'), task('b')] });
  const sent = syncQueue.snapshot();
  await syncQueue.enqueue({ tasks: [task('a')] }); // gönderim sürerken değişti
  await syncQueue.ack(sent);
  expect(syncQueue.snapshot()).toEqual([{ collection: 'tasks', id: 'a', seq: 3 }]);
});

test('reset kuyruğu boşaltır ve devre dışı bırakır', async () => {
  await syncQueue.activate();
  await syncQueue.enqueue({ tasks: [task('a')] });
  await syncQueue.reset();
  await syncQueue.load();
  expect(syncQueue.isActive()).toBe(false);
  expect(syncQueue.size()).toBe(0);
});

test('kimlikte "/" olsa da doğru ayrıştırır', async () => {
  await syncQueue.activate();
  await syncQueue.enqueue({ tasks: [task('x/y')] });
  expect(syncQueue.snapshot()).toEqual([{ collection: 'tasks', id: 'x/y', seq: 1 }]);
});
