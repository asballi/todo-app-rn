import { sortTasks } from '../sorting';

const t = (id, fields = {}) => ({
  id,
  completedAt: null,
  dueDate: null,
  dueTime: null,
  priority: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...fields,
});

test('tamamlanmamışlar önce gelir', () => {
  const ids = sortTasks([t('done', { completedAt: 'x' }), t('open')]).map(x => x.id);
  expect(ids).toEqual(['open', 'done']);
});

test('bitiş zamanına göre, tarihsizler sona', () => {
  const ids = sortTasks([
    t('none'),
    t('later', { dueDate: '2026-09-27' }),
    t('sooner', { dueDate: '2026-09-25' }),
  ]).map(x => x.id);
  expect(ids).toEqual(['sooner', 'later', 'none']);
});

test('aynı gün içinde saatliler saatsizlerden önce, saate göre', () => {
  const ids = sortTasks([
    t('allDay', { dueDate: '2026-09-25' }),
    t('at15', { dueDate: '2026-09-25', dueTime: '15:00' }),
    t('at09', { dueDate: '2026-09-25', dueTime: '09:00' }),
  ]).map(x => x.id);
  expect(ids).toEqual(['at09', 'at15', 'allDay']);
});

test('aynı bitişte önceliğe, sonra oluşturulma zamanına göre', () => {
  const ids = sortTasks([
    t('lowOld', { priority: 1, createdAt: '2026-01-01T00:00:00.000Z' }),
    t('high', { priority: 3 }),
    t('lowNew', { priority: 1, createdAt: '2026-02-01T00:00:00.000Z' }),
  ]).map(x => x.id);
  expect(ids).toEqual(['high', 'lowOld', 'lowNew']);
});

test('girdi dizisini değiştirmez', () => {
  const input = [t('b', { priority: 0 }), t('a', { priority: 3 })];
  sortTasks(input);
  expect(input.map(x => x.id)).toEqual(['b', 'a']);
});
