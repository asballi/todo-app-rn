import { createTask, updateTask, toggleTask, createTag } from '../models';
import { INBOX_ID, newId } from '../ids';
import { tagKey } from '../tags';

test('newId geçerli bir UUID v4 üretir', () => {
  expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(newId()).not.toBe(newId());
});

test('createTask varsayılanları uygular', () => {
  const task = createTask({ title: '  Süt al  ' });
  expect(task).toMatchObject({
    title: 'Süt al',
    notes: '',
    categoryId: INBOX_ID,
    dueDate: null,
    dueTime: null,
    priority: 0,
    completedAt: null,
    deletedAt: null,
  });
  expect(task.createdAt).toBe(task.updatedAt);
});

test('createTask geçersiz alanları reddeder', () => {
  expect(() => createTask({ title: '   ' })).toThrow('boş olamaz');
  expect(() => createTask({ title: 'x', dueDate: '2026-02-30' })).toThrow('Geçersiz tarih');
  expect(() => createTask({ title: 'x', dueDate: '2026-02-01', dueTime: '25:00' })).toThrow('Geçersiz saat');
  expect(() => createTask({ title: 'x', priority: 5 })).toThrow('Geçersiz öncelik');
});

test('tarih kaldırılınca saat de kaldırılır', () => {
  const task = createTask({ title: 'x', dueDate: '2026-09-25', dueTime: '10:00' });
  expect(updateTask(task, { dueDate: null }).dueTime).toBeNull();
});

test('updateTask yalnızca düzenlenebilir alanları değiştirir', () => {
  const task = createTask({ title: 'x' });
  const next = updateTask(task, { title: 'y', id: 'hack', completedAt: 'x' }, new Date(2030, 0, 1));
  expect(next.title).toBe('y');
  expect(next.id).toBe(task.id);
  expect(next.completedAt).toBeNull();
  expect(next.updatedAt).not.toBe(task.updatedAt);
});

test('toggleTask tamamlanma zamanını yazar ve siler', () => {
  const done = toggleTask(createTask({ title: 'x' }));
  expect(done.completedAt).not.toBeNull();
  expect(toggleTask(done).completedAt).toBeNull();
});

test('etiket anahtarı Türkçe büyük/küçük harf kurallarına uyar', () => {
  expect(tagKey('İş')).toBe('iş');
  expect(tagKey('IŞIK')).toBe('ışık');
  expect(tagKey(' Acil ')).toBe('acil');
  expect(createTag({ name: 'İŞ' }).nameKey).toBe(tagKey('iş'));
});
