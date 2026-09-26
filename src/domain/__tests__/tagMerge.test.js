import { mergeDuplicateTags } from '../tagMerge';
import { createTag, createTaskTag, softDelete } from '../models';
import { taskTagId } from '../ids';

const T1 = new Date('2026-09-20T10:00:00Z');
const T2 = new Date('2026-09-21T10:00:00Z');
const NOW = new Date('2026-09-25T10:00:00Z');

// Aynı değişiklikleri state'e uygular (cihazın sonraki hâli).
function apply(state, changes) {
  const next = { ...state };
  for (const [collection, records] of Object.entries(changes)) {
    const byId = new Map(state[collection].map(r => [r.id, r]));
    for (const r of records) byId.set(r.id, r);
    next[collection] = [...byId.values()];
  }
  return next;
}

test('kopya yoksa değişiklik yok', () => {
  const tags = [createTag({ name: 'iş' }, T1), createTag({ name: 'ev' }, T1)];
  expect(mergeDuplicateTags({ tags, taskTags: [] }, NOW)).toEqual({ tags: [], taskTags: [] });
});

test('en eski etiket kalır, bağlar ona taşınır', () => {
  const old = createTag({ name: 'İş', color: '#f00' }, T1);
  const dup = createTag({ name: 'iş', color: '#0f0' }, T2); // nameKey aynı
  const linkA = createTaskTag('a', dup.id, T2);
  const linkB = createTaskTag('b', old.id, T1);
  const linkB2 = createTaskTag('b', dup.id, T2); // b zaten eskisine bağlı

  const { tags, taskTags } = mergeDuplicateTags({ tags: [dup, old], taskTags: [linkA, linkB, linkB2] }, NOW);

  expect(tags).toEqual([expect.objectContaining({ id: dup.id, deletedAt: NOW.toISOString() })]);
  expect(taskTags).toEqual([
    expect.objectContaining({ id: linkA.id, deletedAt: NOW.toISOString() }),
    expect.objectContaining({ id: taskTagId('a', old.id), taskId: 'a', tagId: old.id, deletedAt: null }),
    expect.objectContaining({ id: linkB2.id, deletedAt: NOW.toISOString() }),
  ]);
});

test('eşit createdAt\'ta küçük kimlik kalır; silinmiş etiketler sayılmaz', () => {
  const a = { ...createTag({ name: 'x' }, T1), id: 'b-id' };
  const b = { ...createTag({ name: 'x' }, T1), id: 'a-id' };
  const gone = softDelete({ ...createTag({ name: 'x' }, new Date('2026-01-01')), id: '0-id' }, T1);
  const { tags } = mergeDuplicateTags({ tags: [a, b, gone], taskTags: [] }, NOW);
  expect(tags.map(t => t.id)).toEqual(['b-id']);
});

test('iki cihaz aynı sonuca varır ve ikinci çalıştırma bir şey değiştirmez', () => {
  const old = createTag({ name: 'ev' }, T1);
  const dup = createTag({ name: 'EV' }, T2);
  const state = { tags: [old, dup], taskTags: [createTaskTag('t', dup.id, T2)] };

  const deviceA = mergeDuplicateTags(state, NOW);
  const deviceB = mergeDuplicateTags({ tags: [dup, old], taskTags: [...state.taskTags] }, new Date('2026-09-25T11:00:00Z'));
  const ids = changes => [...changes.tags, ...changes.taskTags].map(r => [r.id, r.deletedAt === null]).sort();
  expect(ids(deviceA)).toEqual(ids(deviceB));

  const merged = apply(state, deviceA);
  expect(mergeDuplicateTags(merged, NOW)).toEqual({ tags: [], taskTags: [] });
});
