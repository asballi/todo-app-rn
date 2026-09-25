import { sortCategories, tasksInCategory, openTaskCountsByCategory } from '../filters';

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
