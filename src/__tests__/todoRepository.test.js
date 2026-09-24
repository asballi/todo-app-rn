import { createTodoRepository } from '../todoRepository';
import { createMemoryBackend } from '../testing/memoryBackend';

function setup(uid = 'ayse') {
  const backend = createMemoryBackend();
  let clock = 1000;
  const now = () => clock++;
  const repo = createTodoRepository(backend, uid, { now });
  let latest = [];
  repo.subscribe(todos => { latest = todos; });
  return { backend, repo, now, visible: () => latest };
}

test('eklenen görev dinleyen tarafa tamamlanmamış olarak ulaşır', async () => {
  const { repo, visible } = setup();

  await repo.add('Süt al');

  expect(visible()).toEqual([
    expect.objectContaining({ text: 'Süt al', done: false }),
  ]);
});

test('görev yazısının başındaki ve sonundaki boşluklar atılır', async () => {
  const { repo, visible } = setup();

  await repo.add('   Süt al  ');

  expect(visible().map(t => t.text)).toEqual(['Süt al']);
});

test('boş ya da sadece boşluktan oluşan görev eklenmez', async () => {
  const { repo, visible } = setup();

  await repo.add('');
  await repo.add('    ');

  expect(visible()).toEqual([]);
});

test('görevler eklenme sırasıyla listelenir', async () => {
  const { repo, visible } = setup();

  await repo.add('Birinci');
  await repo.add('İkinci');
  await repo.add('Üçüncü');

  expect(visible().map(t => t.text)).toEqual(['Birinci', 'İkinci', 'Üçüncü']);
});

test('görev tamamlandı olarak işaretlenir ve geri alınabilir', async () => {
  const { repo, visible } = setup();
  await repo.add('Süt al');
  const [todo] = visible();

  await repo.setDone(todo.id, true);
  expect(visible()[0].done).toBe(true);

  await repo.setDone(todo.id, false);
  expect(visible()[0].done).toBe(false);
});

test('düzenlenen görevin yazısı kırpılarak güncellenir, boş yazı kaydedilmez', async () => {
  const { repo, visible } = setup();
  await repo.add('Süt al');
  const [todo] = visible();

  await repo.edit(todo.id, '  Ekmek al ');
  expect(visible()[0].text).toBe('Ekmek al');

  await repo.edit(todo.id, '   ');
  expect(visible()[0].text).toBe('Ekmek al');
});

test('silinen görev listeden kalkar, diğerleri kalır', async () => {
  const { repo, visible } = setup();
  await repo.add('Süt al');
  await repo.add('Ekmek al');
  const [milk] = visible();

  await repo.remove(milk.id);

  expect(visible().map(t => t.text)).toEqual(['Ekmek al']);
});

test('tamamlananları sil yalnızca tamamlanmış görevleri kaldırır', async () => {
  const { repo, visible } = setup();
  await repo.add('Süt al');
  await repo.add('Ekmek al');
  await repo.add('Yumurta al');
  const [milk, , eggs] = visible();
  await repo.setDone(milk.id, true);
  await repo.setDone(eggs.id, true);

  await repo.clearDone();

  expect(visible().map(t => t.text)).toEqual(['Ekmek al']);
});

test('bir kullanıcının görevleri başka kullanıcıya görünmez', async () => {
  const backend = createMemoryBackend();
  const ayse = createTodoRepository(backend, 'ayse');
  const mehmet = createTodoRepository(backend, 'mehmet');
  let mehmetSees = [];
  mehmet.subscribe(todos => { mehmetSees = todos; });

  await ayse.add('Ayşe’nin görevi');
  await ayse.clearDone();

  expect(mehmetSees).toEqual([]);
});
