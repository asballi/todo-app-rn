import { normalizeReminders, reminderAnchor, plannedNotifications } from '../reminders';

describe('normalizeReminders', () => {
  test('tarih yoksa boş', () => {
    expect(normalizeReminders([0, 60], null)).toEqual([]);
  });

  test('tekilleştirir ve sıralar', () => {
    expect(normalizeReminders([60, 0, 60], '2026-09-25')).toEqual([0, 60]);
  });

  test('geçersiz değer ve 3 sınırı', () => {
    expect(() => normalizeReminders([5], '2026-09-25')).toThrow('Geçersiz');
    expect(() => normalizeReminders([0, 10, 30, 60], '2026-09-25')).toThrow('En fazla 3');
  });
});

describe('reminderAnchor', () => {
  test('saatli görevde bitiş saati, saatsizde varsayılan saat', () => {
    expect(reminderAnchor({ dueDate: '2026-09-25', dueTime: '15:00' }, '09:00')).toEqual(new Date(2026, 8, 25, 15, 0));
    expect(reminderAnchor({ dueDate: '2026-09-25', dueTime: null }, '08:30')).toEqual(new Date(2026, 8, 25, 8, 30));
    expect(reminderAnchor({ dueDate: '2026-09-25', dueTime: null }, 'bozuk')).toEqual(new Date(2026, 8, 25, 9, 0));
  });
});

describe('plannedNotifications', () => {
  const NOW = new Date(2026, 8, 25, 10, 0);
  const task = (id, fields) => ({
    id,
    title: id,
    dueDate: '2026-09-26',
    dueTime: '15:00',
    reminders: [0],
    completedAt: null,
    deletedAt: null,
    ...fields,
  });

  test('bitiş anından önce, gövde bildirim anına göre', () => {
    const [dayBefore, onTime] = plannedNotifications([task('a', { reminders: [0, 1440] })], {}, NOW);
    expect(dayBefore.at).toEqual(new Date(2026, 8, 25, 15, 0));
    expect(dayBefore.body).toBe('Yarın 15:00');
    expect(onTime.at).toEqual(new Date(2026, 8, 26, 15, 0));
    expect(onTime.body).toBe('Bugün 15:00');
    expect(onTime.taskId).toBe('a');
  });

  test('saatsiz görev varsayılan saati kullanır', () => {
    const [n] = plannedNotifications([task('a', { dueTime: null })], { defaultReminderTime: '08:00' }, NOW);
    expect(n.at).toEqual(new Date(2026, 8, 26, 8, 0));
    expect(n.body).toBe('Bugün');
  });

  test('geçmiş, tamamlanmış, silinmiş ve tarihsiz olanlar dahil edilmez', () => {
    const planned = plannedNotifications(
      [
        task('past', { dueDate: '2026-09-25', dueTime: '09:00' }),
        task('done', { completedAt: 'x' }),
        task('deleted', { deletedAt: 'x' }),
        task('undated', { dueDate: null }),
        task('none', { reminders: [] }),
        task('ok'),
      ],
      {},
      NOW,
    );
    expect(planned.map(p => p.taskId)).toEqual(['ok']);
  });

  test('başlık veya zaman değişince anahtar değişir', () => {
    const [a] = plannedNotifications([task('a')], {}, NOW);
    const [renamed] = plannedNotifications([task('a', { title: 'yeni' })], {}, NOW);
    const [moved] = plannedNotifications([task('a', { dueTime: '16:00' })], {}, NOW);
    expect(renamed.key).not.toBe(a.key);
    expect(moved.key).not.toBe(a.key);
    expect(plannedNotifications([task('a')], {}, NOW)[0].key).toBe(a.key);
  });
});
