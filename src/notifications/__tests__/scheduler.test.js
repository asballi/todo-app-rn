import { syncNotifications, createSyncer } from '../scheduler';

function fakeAdapter({ granted = true, scheduled = [] } = {}) {
  let seq = 0;
  const items = new Map(scheduled.map(s => [s.id, s]));
  return {
    items,
    calls: [],
    canSchedule: async () => granted,
    listScheduled: async () => [...items.values()],
    async schedule(item) {
      const id = `n${++seq}`;
      items.set(id, { id, key: item.key });
      this.calls.push(['schedule', item.key]);
      return id;
    },
    async cancel(id) {
      items.delete(id);
      this.calls.push(['cancel', id]);
    },
  };
}

const keys = adapter => [...adapter.items.values()].map(i => i.key).sort();

test('eksikleri kurar, eskileri iptal eder, aynıları bırakır', async () => {
  const adapter = fakeAdapter({ scheduled: [{ id: 'old', key: 'b' }, { id: 'stale', key: 'x' }] });
  const result = await syncNotifications(adapter, [{ key: 'a' }, { key: 'b' }]);
  expect(keys(adapter)).toEqual(['a', 'b']);
  expect(result).toEqual({ scheduled: 1, cancelled: 1 });
  expect(adapter.items.has('old')).toBe(true);
});

test('aynı anahtarlı çift bildirimlerden biri iptal edilir', async () => {
  const adapter = fakeAdapter({ scheduled: [{ id: '1', key: 'a' }, { id: '2', key: 'a' }] });
  await syncNotifications(adapter, [{ key: 'a' }]);
  expect(adapter.items.size).toBe(1);
});

test('izin yoksa hepsi iptal edilir, yenisi kurulmaz', async () => {
  const adapter = fakeAdapter({ granted: false, scheduled: [{ id: '1', key: 'a' }] });
  await syncNotifications(adapter, [{ key: 'a' }, { key: 'b' }]);
  expect(adapter.items.size).toBe(0);
});

test('ikinci eşitleme değişiklik yapmaz', async () => {
  const adapter = fakeAdapter();
  await syncNotifications(adapter, [{ key: 'a' }]);
  adapter.calls = [];
  await syncNotifications(adapter, [{ key: 'a' }]);
  expect(adapter.calls).toEqual([]);
});

test('createSyncer eşzamanlı istekleri birleştirir, son planı uygular', async () => {
  const adapter = fakeAdapter();
  const sync = createSyncer(adapter);
  sync([{ key: 'a' }]);
  sync([{ key: 'b' }]);
  await sync([{ key: 'c' }]);
  expect(keys(adapter)).toEqual(['c']);
});
