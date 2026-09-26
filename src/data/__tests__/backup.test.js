import { buildBackup, parseBackup, mergeBackup, hasChanges, backupFileName } from '../backup';

const rec = (id, updatedAt, fields = {}) => ({ id, createdAt: '2026-01-01T00:00:00.000Z', updatedAt, deletedAt: null, ...fields });
const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-02-01T00:00:00.000Z';
const T3 = '2026-03-01T00:00:00.000Z';

const state = (fields = {}) => ({
  tasks: [], categories: [], tags: [], taskTags: [], settings: { defaultReminderTime: '09:00' }, ...fields,
});
const backupOf = (data, extra = {}) =>
  JSON.stringify({ app: 'todoapp', schemaVersion: 3, exportedAt: T3, data: { tasks: [], categories: [], tags: [], taskTags: [], ...data }, ...extra });

describe('buildBackup', () => {
  test('tüm koleksiyonlar (silinmişler dahil) ve ayarlar', () => {
    const s = state({ tasks: [rec('a', T1), rec('b', T1, { deletedAt: T2 })] });
    const backup = buildBackup(s, new Date(T3));
    expect(backup).toMatchObject({ app: 'todoapp', schemaVersion: 3, exportedAt: T3 });
    expect(backup.data.tasks.map(t => t.id)).toEqual(['a', 'b']);
    expect(backup.data.settings).toEqual({ defaultReminderTime: '09:00' });
  });

  test('dosya adı yerel tarihi içerir', () => {
    expect(backupFileName(new Date(2026, 8, 5, 23, 30))).toBe('yapilacaklar-yedek-2026-09-05.json');
  });
});

describe('parseBackup', () => {
  test('geçerli yedeği kabul eder; kendi çıktısıyla gidiş-dönüş', () => {
    const backup = buildBackup(state({ tasks: [rec('a', T1, { title: 'x' })] }), new Date(T3));
    expect(parseBackup(JSON.stringify(backup)).data.tasks).toEqual(backup.data.tasks);
  });

  test.each([
    ['bozuk JSON', '{bozuk'],
    ['başka uygulama', JSON.stringify({ app: 'baska', schemaVersion: 3, data: {} })],
    ['veri yok', JSON.stringify({ app: 'todoapp', schemaVersion: 3 })],
    ['sürüm yok', JSON.stringify({ app: 'todoapp', data: {} })],
    ['çok eski sürüm', JSON.stringify({ app: 'todoapp', schemaVersion: 1, data: {} })],
    ['kimliksiz kayıt', backupOf({ tasks: [{ updatedAt: T1 }] })],
    ['dizi olmayan koleksiyon', backupOf({ tags: {} })],
  ])('%s reddedilir', (_, text) => {
    expect(() => parseBackup(text)).toThrow('geçerli bir yedek değil');
  });

  test('daha yeni sürüm yedek reddedilir', () => {
    expect(() => parseBackup(backupOf({}, { schemaVersion: 99 }))).toThrow('daha yeni bir sürümünden');
  });

  test('şema 2 yedek güncel biçime çevrilir', () => {
    const parsed = parseBackup(backupOf({ tasks: [rec('a', T1, { title: 'x' })] }, { schemaVersion: 2 }));
    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.data.tasks[0]).toMatchObject({ checklist: [], reminders: [], recurrence: null, nextTaskId: null });
  });
});

describe('mergeBackup', () => {
  test('yeniler eklenir, daha yeni güncellenir, daha eski ve aynı olanlar atlanır', () => {
    const current = state({ tasks: [rec('same', T2), rec('older', T2, { title: 'yerel' }), rec('newer', T1, { title: 'yerel' })] });
    const backup = parseBackup(backupOf({
      tasks: [rec('same', T2), rec('older', T1, { title: 'yedek' }), rec('newer', T2, { title: 'yedek' }), rec('new', T1)],
    }));
    const { changes, summary } = mergeBackup(current, backup);
    expect(changes.tasks.map(t => t.id).sort()).toEqual(['new', 'newer']);
    expect(changes.tasks.find(t => t.id === 'newer').title).toBe('yedek');
    expect(summary.tasks).toEqual({ added: 1, updated: 1, deleted: 0 });
  });

  test('yedekteki silme daha yeniyse uygulanır ve "silinen" sayılır', () => {
    const current = state({ tasks: [rec('a', T1)] });
    const backup = parseBackup(backupOf({ tasks: [rec('a', T2, { deletedAt: T2 })] }));
    const { changes, summary } = mergeBackup(current, backup);
    expect(changes.tasks[0].deletedAt).toBe(T2);
    expect(summary.tasks).toEqual({ added: 0, updated: 0, deleted: 1 });
  });

  test('silinmiş olarak gelen yeni kayıt saklanır ama "eklenen" sayılmaz', () => {
    const backup = parseBackup(backupOf({ tasks: [rec('gone', T1, { deletedAt: T1 })] }));
    const { changes, summary } = mergeBackup(state(), backup);
    expect(changes.tasks.map(t => t.id)).toEqual(['gone']);
    expect(summary.tasks).toEqual({ added: 0, updated: 0, deleted: 0 });
    expect(hasChanges(changes)).toBe(true);
  });

  test('aynı adda farklı kimlikli etiket mevcut etikete bağlanır, çift bağ eklenmez', () => {
    const current = state({
      tasks: [rec('t1', T1)],
      tags: [rec('local-acil', T1, { name: 'Acil', nameKey: 'acil' })],
      taskTags: [rec('l-local', T1, { taskId: 't1', tagId: 'local-acil' })],
    });
    const backup = parseBackup(backupOf({
      tasks: [rec('t1', T1), rec('t2', T1)],
      tags: [rec('other-acil', T1, { name: 'acil', nameKey: 'acil' })],
      taskTags: [
        rec('l-dup', T1, { taskId: 't1', tagId: 'other-acil' }),
        rec('l-new', T1, { taskId: 't2', tagId: 'other-acil' }),
      ],
    }));
    const { changes, summary } = mergeBackup(current, backup);
    expect(changes.tags).toEqual([]);
    expect(changes.taskTags).toEqual([expect.objectContaining({ id: 'l-new', taskId: 't2', tagId: 'local-acil' })]);
    expect(summary.tags).toEqual({ added: 0, updated: 0, deleted: 0 });
  });

  test('değişiklik yoksa hasChanges false', () => {
    const current = state({ tasks: [rec('a', T1)] });
    const { changes } = mergeBackup(current, parseBackup(backupOf({ tasks: [rec('a', T1)] })));
    expect(hasChanges(changes)).toBe(false);
  });
});
