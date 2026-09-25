import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTodoStore, initialState, liveRecords } from '../useTodoStore';
import { KEYS, readJson } from '../../data/storage';
import { INBOX_ID } from '../../domain/ids';

const store = () => useTodoStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useTodoStore.setState(initialState);
  await store().init();
});

// Bellekteki durumun depoya da yazıldığını doğrular.
async function persisted(collection) {
  return readJson(KEYS[collection], []);
}

test('init Gelen Kutusu ile hazır duruma geçer', () => {
  expect(store().status).toBe('ready');
  expect(store().categories.map(c => c.id)).toEqual([INBOX_ID]);
});

test('init eski görevleri taşır', async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(KEYS.legacyTodos, JSON.stringify([{ id: 1, text: 'eski', done: true }]));
  useTodoStore.setState(initialState);
  await store().init();
  expect(store().tasks).toEqual([expect.objectContaining({ title: 'eski' })]);
  expect(store().tasks[0].completedAt).not.toBeNull();
});

describe('görevler', () => {
  test('ekleme, güncelleme, tamamlama ve silme depoya yazılır', async () => {
    const task = await store().addTask({ title: 'Süt al', priority: 2 });
    expect(task.categoryId).toBe(INBOX_ID);

    await store().updateTask(task.id, { title: 'Süt ve ekmek al' });
    await store().toggleTask(task.id);
    let saved = (await persisted('tasks'))[0];
    expect(saved.title).toBe('Süt ve ekmek al');
    expect(saved.completedAt).not.toBeNull();

    await store().deleteTasks([task.id]);
    saved = (await persisted('tasks'))[0];
    expect(saved.deletedAt).not.toBeNull();
    expect(liveRecords(store().tasks)).toEqual([]);
  });

  test('etiketlerle birlikte eklenebilir', async () => {
    const tag = await store().findOrCreateTag('acil');
    const task = await store().addTask({ title: 'x', tagIds: [tag.id, tag.id] });
    const links = liveRecords(store().taskTags);
    expect(links).toEqual([expect.objectContaining({ taskId: task.id, tagId: tag.id })]);
  });

  test('olmayan kategori veya etiketle eklenemez', async () => {
    await expect(store().addTask({ title: 'x', categoryId: 'yok' })).rejects.toThrow('bulunamadı');
    await expect(store().addTask({ title: 'x', tagIds: ['yok'] })).rejects.toThrow('bulunamadı');
    expect(store().tasks).toEqual([]);
  });

  test('silinmiş görev güncellenemez', async () => {
    const task = await store().addTask({ title: 'x' });
    await store().deleteTasks([task.id]);
    await expect(store().toggleTask(task.id)).rejects.toThrow('bulunamadı');
  });

  test('setTaskTags bağları ekler ve kaldırır', async () => {
    const a = await store().findOrCreateTag('a');
    const b = await store().findOrCreateTag('b');
    const task = await store().addTask({ title: 'x', tagIds: [a.id] });

    await store().setTaskTags(task.id, [b.id]);
    const live = liveRecords(store().taskTags).map(l => l.tagId);
    expect(live).toEqual([b.id]);
    expect(await persisted('taskTags')).toHaveLength(2);
  });
});

test('updateTask tagIds ile etiketleri aynı işlemde günceller', async () => {
  const a = await store().findOrCreateTag('a');
  const b = await store().findOrCreateTag('b');
  const task = await store().addTask({ title: 'x', tagIds: [a.id] });

  await store().updateTask(task.id, { title: 'y', tagIds: [b.id] });

  expect(store().tasks[0].title).toBe('y');
  expect(liveRecords(store().taskTags).map(l => l.tagId)).toEqual([b.id]);
  expect(liveRecords(await persisted('taskTags')).map(l => l.tagId)).toEqual([b.id]);
});

test('updateTask tagIds verilmezse etiketlere dokunmaz', async () => {
  const a = await store().findOrCreateTag('a');
  const task = await store().addTask({ title: 'x', tagIds: [a.id] });
  await store().updateTask(task.id, { title: 'y' });
  expect(liveRecords(store().taskTags)).toHaveLength(1);
});

describe('kategoriler', () => {
  test('Gelen Kutusu silinemez ama yeniden adlandırılabilir', async () => {
    await expect(store().deleteCategory(INBOX_ID)).rejects.toThrow('silinemez');
    await store().updateCategory(INBOX_ID, { name: 'Gelenler' });
    expect(store().categories[0].name).toBe('Gelenler');
  });

  test('yeni kategoriler sona eklenir', async () => {
    const work = await store().addCategory({ name: 'İş' });
    const home = await store().addCategory({ name: 'Ev' });
    expect(work.sortOrder).toBe(1);
    expect(home.sortOrder).toBe(2);
  });

  test('silinen kategorinin görevleri Gelen Kutusu\'na taşınır', async () => {
    const work = await store().addCategory({ name: 'İş', color: '#f00', icon: 'briefcase' });
    const task = await store().addTask({ title: 'Rapor', categoryId: work.id });

    await store().deleteCategory(work.id);

    expect(store().tasks.find(t => t.id === task.id).categoryId).toBe(INBOX_ID);
    expect((await persisted('tasks'))[0].categoryId).toBe(INBOX_ID);
    expect(liveRecords(store().categories).map(c => c.id)).toEqual([INBOX_ID]);
  });
});

describe('etiketler', () => {
  test('büyük/küçük harf fark etmeksizin aynı etiketi döndürür', async () => {
    const first = await store().findOrCreateTag('İş');
    const second = await store().findOrCreateTag('  iş ');
    expect(second.id).toBe(first.id);
    expect(store().tags).toHaveLength(1);
  });

  test('addTag aynı adda etiket varsa hata verir', async () => {
    await store().addTag({ name: 'Acil', color: '#e05c5c' });
    await expect(store().addTag({ name: 'ACİL' })).rejects.toThrow('zaten var');
    expect(store().tags).toHaveLength(1);
    expect(store().tags[0].color).toBe('#e05c5c');
  });

  test('başka bir etiketin adına yeniden adlandırılamaz', async () => {
    await store().findOrCreateTag('Acil');
    const other = await store().findOrCreateTag('Telefon');
    await expect(store().updateTag(other.id, { name: 'ACİL' })).rejects.toThrow('zaten var');
    await store().updateTag(other.id, { name: 'TELEFON' });
    expect(store().tags.find(t => t.id === other.id).name).toBe('TELEFON');
  });

  test('silinen etiketin bağları kalkar, görevler kalır', async () => {
    const tag = await store().findOrCreateTag('acil');
    await store().addTask({ title: 'x', tagIds: [tag.id] });

    await store().deleteTag(tag.id);

    expect(liveRecords(store().tasks)).toHaveLength(1);
    expect(liveRecords(store().taskTags)).toEqual([]);
    expect(liveRecords(store().tags)).toEqual([]);
  });

  test('silinmiş bir etiketle aynı adda yeni etiket oluşturulabilir', async () => {
    const old = await store().findOrCreateTag('acil');
    await store().deleteTag(old.id);
    const fresh = await store().findOrCreateTag('acil');
    expect(fresh.id).not.toBe(old.id);
  });
});
