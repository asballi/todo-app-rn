import {
  sortCategories,
  tasksInCategory,
  openTaskCountsByCategory,
  sortTags,
  tagsByTask,
  tasksWithTag,
  openTaskCountsByTag,
  suggestTags,
} from '../filters';
import { tagKey } from '../tags';

const task = (id, categoryId, fields = {}) => ({
  id,
  categoryId,
  completedAt: null,
  deletedAt: null,
  dueDate: null,
  dueTime: null,
  priority: 0,
  createdAt: `2026-01-0${id.length}T00:00:00.000Z`,
  ...fields,
});

test('sortCategories silinmişleri çıkarır ve sıraya dizer', () => {
  const result = sortCategories([
    { id: 'b', name: 'Ev', sortOrder: 2, deletedAt: null },
    { id: 'x', name: 'Eski', sortOrder: 1, deletedAt: 'x' },
    { id: 'inbox', name: 'Gelen Kutusu', sortOrder: 0, deletedAt: null },
    { id: 'a', name: 'İş', sortOrder: 1, deletedAt: null },
  ]);
  expect(result.map(c => c.id)).toEqual(['inbox', 'a', 'b']);
});

test('tasksInCategory yalnızca o kategorinin canlı görevlerini sıralı döndürür', () => {
  const result = tasksInCategory(
    [
      task('done', 'work', { completedAt: 'x' }),
      task('open', 'work'),
      task('deleted', 'work', { deletedAt: 'x' }),
      task('other', 'home'),
    ],
    'work',
  );
  expect(result.map(t => t.id)).toEqual(['open', 'done']);
});

test('openTaskCountsByCategory yalnızca açık ve canlı görevleri sayar', () => {
  expect(
    openTaskCountsByCategory([
      task('a', 'work'),
      task('bb', 'work'),
      task('done', 'work', { completedAt: 'x' }),
      task('del', 'home', { deletedAt: 'x' }),
      task('c', 'inbox'),
    ]),
  ).toEqual({ work: 2, inbox: 1 });
});

describe('etiket filtreleri', () => {
  const tag = (id, name, fields = {}) => ({ id, name, nameKey: tagKey(name), deletedAt: null, ...fields });
  const link = (taskId, tagId, fields = {}) => ({ id: `${taskId}-${tagId}`, taskId, tagId, deletedAt: null, ...fields });
  const tags = [tag('t1', 'telefon'), tag('t2', 'Acil'), tag('t3', 'eski', { deletedAt: 'x' }), tag('t4', 'İş')];
  const links = [
    link('a', 't1'),
    link('a', 't2'),
    link('a', 't3'),
    link('b', 't2'),
    link('c', 't2', { deletedAt: 'x' }),
    link('done', 't2'),
  ];
  const tasks = [task('a', 'inbox'), task('b', 'inbox'), task('c', 'inbox'), task('done', 'inbox', { completedAt: 'x' })];

  test('sortTags Türkçe alfabeye göre sıralar ve silinmişleri çıkarır', () => {
    expect(sortTags(tags).map(t => t.name)).toEqual(['Acil', 'İş', 'telefon']);
  });

  test('tagsByTask canlı bağları ve etiketleri ada göre döndürür', () => {
    const result = tagsByTask(tags, links);
    expect(result.a.map(t => t.name)).toEqual(['Acil', 'telefon']);
    expect(result.b.map(t => t.name)).toEqual(['Acil']);
    expect(result.c).toBeUndefined();
  });

  test('tasksWithTag canlı bağlı görevleri sıralı döndürür', () => {
    expect(tasksWithTag(tasks, links, 't2').map(t => t.id)).toEqual(['a', 'b', 'done']);
  });

  test('openTaskCountsByTag yalnızca açık görevleri sayar', () => {
    expect(openTaskCountsByTag(tasks, links)).toEqual({ t1: 1, t2: 2, t3: 1 });
  });

  test('suggestTags büyük/küçük harf ve Türkçe kurallarıyla eşleştirir', () => {
    expect(suggestTags(tags, 'İ').map(t => t.name)).toEqual(['Acil', 'İş']);
    expect(suggestTags(tags, 'ACİ').map(t => t.name)).toEqual(['Acil']);
    expect(suggestTags(tags, '', ['t2']).map(t => t.name)).toEqual(['İş', 'telefon']);
  });
});
