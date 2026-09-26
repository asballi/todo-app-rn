import { createFakeServer } from '../remote.fake';
import { liveRecords } from '../../domain/models';

// Her "cihaz" kendi modül kopyasını (store, kuyruk, motor) ve kendi AsyncStorage'ını
// alır; sunucu ortaktır. Böylece iki cihaz arasındaki senkron tek süreçte sınanır.
function memoryStorage() {
  const data = new Map();
  return {
    __esModule: true,
    default: {
      getItem: async key => (data.has(key) ? data.get(key) : null),
      setItem: async (key, value) => { data.set(key, value); },
      removeItem: async key => { data.delete(key); },
      multiSet: async entries => { for (const [key, value] of entries) data.set(key, value); },
    },
  };
}

async function device(server, userId, options = {}) {
  let mods;
  jest.isolateModules(() => {
    jest.doMock('@react-native-async-storage/async-storage', memoryStorage);
    mods = {
      store: require('../../store/useTodoStore').useTodoStore,
      queue: require('../queue').syncQueue,
      storage: require('../../data/storage'),
      createSyncEngine: require('../engine').createSyncEngine,
    };
  });
  await mods.store.getState().init();
  const remote = server.connect(userId);
  const engine = mods.createSyncEngine({ remote, store: mods.store, queue: mods.queue, ...options });
  await engine.load();
  const s = () => mods.store.getState();
  return {
    ...mods,
    remote,
    engine,
    s,
    titles: () => liveRecords(s().tasks).map(t => t.title).sort(),
    task: title => liveRecords(s().tasks).find(t => t.title === title),
    stored: key => mods.storage.readJson(mods.storage.KEYS[key], null),
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

let server;
beforeEach(() => {
  server = createFakeServer();
});

// Reddedilen kayıtlar için beklenen uyarıyı susturur.
const quietWarnings = () => jest.spyOn(console, 'warn').mockImplementation(() => {});
afterEach(() => jest.restoreAllMocks());

describe('ilk giriş (X2)', () => {
  test('iki cihazın girişsiz verisi birleşir; kimse bir şey kaybetmez', async () => {
    const a = await device(server, 'u1');
    const b = await device(server, 'u1');
    await a.s().addTask({ title: 'A görevi' });
    await b.s().addTask({ title: 'B görevi' });
    const deletedOnB = await b.s().addTask({ title: 'B silinen' });
    await b.s().deleteTasks([deletedOnB.id]);

    expect((await a.engine.start('u1')).phase).toBe('idle');
    await b.engine.start('u1');
    await a.engine.sync();

    expect(a.titles()).toEqual(['A görevi', 'B görevi']);
    expect(b.titles()).toEqual(['A görevi', 'B görevi']);
    // Silinmiş kayıtlar da gönderilir (başka cihazda canlı kopyası varsa silinsin diye).
    expect(server.rows('u1', 'tasks').find(r => r.id === deletedOnB.id).deleted_at).not.toBeNull();
    expect(a.engine.getStatus()).toMatchObject({ phase: 'idle', pending: 0, userId: 'u1' });
  });

  test('yeni cihazın Gelen Kutusu, yeniden adlandırılmış olanın üzerine yazmaz', async () => {
    const a = await device(server, 'u1');
    await a.s().updateCategory('inbox', { name: 'Gelenler' });
    await a.engine.start('u1');

    const b = await device(server, 'u1');
    await b.engine.start('u1');
    await a.engine.sync();

    expect(b.s().categories.find(c => c.id === 'inbox').name).toBe('Gelenler');
    expect(a.s().categories.find(c => c.id === 'inbox').name).toBe('Gelenler');
  });

  test('girişten sonra kuyruk etkin; aynı kullanıcıyla yeniden başlatmak yalnızca eşitler', async () => {
    const a = await device(server, 'u1');
    await a.engine.start('u1');
    expect(a.queue.isActive()).toBe(true);
    expect(await a.stored('syncState')).toMatchObject({ userId: 'u1' });

    const calls = a.remote.calls.length;
    await a.engine.start('u1');
    expect(a.remote.calls.slice(calls)).toEqual(['pull']); // kuyruk boş: gönderme yok
  });

  test('başka bir hesap girişliyken başlatılamaz', async () => {
    const a = await device(server, 'u1');
    await a.engine.start('u1');
    await expect(a.engine.start('u2')).rejects.toThrow('önce çıkış');
  });

  test('açılışta kayıtlı oturum yüklenir', async () => {
    const a = await device(server, 'u1');
    expect(await a.engine.load()).toBeNull();
    expect(a.engine.getStatus().phase).toBe('signedOut');
    await a.engine.start('u1');
    expect(await a.engine.load()).toBe('u1');
  });
});

describe('değişikliklerin yayılması', () => {
  test('ekleme, düzenleme, tamamlama, etiket ve silme diğer cihaza geçer', async () => {
    const a = await device(server, 'u1');
    const b = await device(server, 'u1');
    await a.engine.start('u1');
    await b.engine.start('u1');

    const tag = await a.s().findOrCreateTag('ev');
    const category = await a.s().addCategory({ name: 'İş' });
    const task = await a.s().addTask({ title: 'Süt al', categoryId: category.id, tagIds: [tag.id], dueDate: '2026-09-30', dueTime: '15:30', priority: 3 });
    await a.engine.sync();
    await b.engine.sync();
    expect(b.task('Süt al')).toEqual(task);
    expect(liveRecords(b.s().taskTags)).toEqual(liveRecords(a.s().taskTags));
    expect(liveRecords(b.s().categories).map(c => c.name).sort()).toEqual(['Gelen Kutusu', 'İş']);

    await sleep(2);
    await b.s().toggleTask(task.id);
    await b.s().updateTask(task.id, { notes: 'yağsız' });
    await b.engine.sync();
    await a.engine.sync();
    expect(a.task('Süt al')).toMatchObject({ notes: 'yağsız' });
    expect(a.task('Süt al').completedAt).not.toBeNull();

    await sleep(2);
    await a.s().deleteTasks([task.id]);
    await a.engine.sync();
    await b.engine.sync();
    expect(b.titles()).toEqual([]);
    expect(b.s().tasks.find(t => t.id === task.id).deletedAt).not.toBeNull();
  });

  test('uzaktan gelen kayıtlar kuyruğa girmez ve geri gönderilmez', async () => {
    const a = await device(server, 'u1');
    const b = await device(server, 'u1');
    await a.engine.start('u1');
    await b.engine.start('u1');
    await a.s().addTask({ title: 'x' });
    await a.engine.sync();
    const calls = b.remote.calls.length;
    await b.engine.sync();
    expect(b.queue.size()).toBe(0);
    expect(b.remote.calls.slice(calls)).toEqual(['pull']);
  });

  test('uzaktan gelen değişiklik geri alma kaydının kaydına dokunursa geri alma iptal olur', async () => {
    const a = await device(server, 'u1');
    const b = await device(server, 'u1');
    await a.engine.start('u1');
    await b.engine.start('u1');
    const task = await a.s().addTask({ title: 'x' });
    await a.engine.sync();
    await b.engine.sync();

    await a.s().deleteTasks([task.id]);
    expect(a.s().lastUndo).not.toBeNull();
    await sleep(2);
    await b.s().updateTask(task.id, { title: 'y' });
    await b.engine.sync();
    await a.engine.sync(); // A'nın silmesi gider ama B'nin düzenlemesi daha yeni: geri gelir

    expect(a.titles()).toEqual(['y']);
    expect(a.s().lastUndo).toBeNull();
  });

  test('sayfalar ve gönderim grupları küçükken de her şey eşitlenir', async () => {
    const a = await device(server, 'u1', { batchSize: 3, pageSize: 3 });
    const b = await device(server, 'u1', { batchSize: 3, pageSize: 3 });
    for (let i = 0; i < 10; i++) await a.s().addTask({ title: `t${String(i).padStart(2, '0')}` });
    await a.engine.start('u1');
    await b.engine.start('u1');
    expect(b.titles()).toEqual(a.titles());
    expect(b.titles()).toHaveLength(10);
    expect(a.remote.calls.filter(c => c === 'push').length).toBeGreaterThanOrEqual(4);
  });
});

describe('çakışmalar (X6)', () => {
  test('iki cihaz çevrimdışıyken aynı görevi düzenlerse son düzenleme kazanır', async () => {
    const a = await device(server, 'u1');
    const b = await device(server, 'u1');
    await a.engine.start('u1');
    const task = await a.s().addTask({ title: 'ilk' });
    await a.engine.sync();
    await b.engine.start('u1');

    a.remote.online = false;
    b.remote.online = false;
    await a.s().updateTask(task.id, { title: 'A' });
    await sleep(2);
    await b.s().updateTask(task.id, { title: 'B' });
    a.remote.online = true;
    b.remote.online = true;

    await b.engine.sync(); // önce daha yeni olan gider
    await a.engine.sync(); // A'nın eskisi reddedilir, B'ninki gelir
    await b.engine.sync();
    expect(a.titles()).toEqual(['B']);
    expect(b.titles()).toEqual(['B']);
    expect(a.queue.size()).toBe(0);
  });

  test('gönderim sürerken yapılan düzenleme kaybolmaz', async () => {
    const a = await device(server, 'u1');
    await a.engine.start('u1');
    const task = await a.s().addTask({ title: 'ilk' });
    const push = a.remote.push;
    a.remote.push = async (...args) => {
      const result = await push(...args);
      await sleep(2); // aynı milisaniyedeki düzenleme eşit updatedAt olurdu
      await a.s().updateTask(task.id, { title: 'gönderim sırasında' });
      a.remote.push = push;
      return result;
    };
    await a.engine.sync();
    expect(server.rows('u1', 'tasks').find(r => r.id === task.id).title).toBe('gönderim sırasında');
    expect(a.queue.size()).toBe(0);
  });
});

describe('çevrimdışı ve hatalar', () => {
  test('çevrimdışıyken değişiklikler kuyrukta bekler, bağlantı gelince gider', async () => {
    const a = await device(server, 'u1');
    await a.engine.start('u1');
    a.remote.online = false;
    await a.s().addTask({ title: 'çevrimdışı' });
    const status = await a.engine.sync();
    expect(status).toMatchObject({ phase: 'error', errorKind: 'network', pending: 1 });
    expect(server.rows('u1', 'tasks')).toEqual([]);

    a.remote.online = true;
    expect((await a.engine.sync()).phase).toBe('idle');
    expect(server.rows('u1', 'tasks').map(r => r.title)).toEqual(['çevrimdışı']);
  });

  test('sunucunun reddettiği kayıt engellenir, diğerleri gider; düzeltilince gönderilir', async () => {
    const a = await device(server, 'u1', { batchSize: 10 });
    await a.engine.start('u1');
    const good = [];
    for (let i = 0; i < 4; i++) good.push(await a.s().addTask({ title: `iyi ${i}` }));
    quietWarnings();
    const bad = await a.s().addTask({ title: 'bozuk' });
    // Yerelde bozulmuş bir kayıt (ör. eski bir hatadan kalma)
    a.store.setState(st => ({ tasks: st.tasks.map(t => (t.id === bad.id ? { ...t, priority: 7 } : t)) }));

    const status = await a.engine.sync();
    expect(status).toMatchObject({ phase: 'idle', pending: 1, blocked: 1 });
    expect(server.rows('u1', 'tasks').map(r => r.title).sort()).toEqual(good.map(t => t.title).sort());

    await a.s().updateTask(bad.id, { priority: 1 });
    expect((await a.engine.sync())).toMatchObject({ pending: 0, blocked: 0 });
    expect(server.rows('u1', 'tasks')).toHaveLength(5);
  });

  test('eski sürüm senkronu durdurur; yerel kullanım ve kuyruk sürer (X8)', async () => {
    const a = await device(server, 'u1');
    await a.engine.start('u1');
    server.minSchemaVersion = 4;
    await a.s().addTask({ title: 'bekleyen' });
    expect(await a.engine.sync()).toMatchObject({ phase: 'outdated', errorKind: 'outdated', pending: 1 });
    expect(a.titles()).toEqual(['bekleyen']);

    server.minSchemaVersion = 3;
    expect(await a.engine.sync()).toMatchObject({ phase: 'idle', pending: 0 });
  });

  test('durum değişiklikleri dinleyicilere bildirilir', async () => {
    const a = await device(server, 'u1');
    const phases = [];
    a.engine.subscribe(s => phases.push(s.phase));
    await a.engine.start('u1');
    expect(phases).toEqual(['syncing', 'idle']);
  });

  test('eşitleme sürerken gelen istek bittikten sonra bir kez daha çalışır', async () => {
    const a = await device(server, 'u1');
    await a.engine.start('u1');
    const calls = a.remote.calls.length;
    await a.s().addTask({ title: 'x' });
    const first = a.engine.sync();
    const second = a.engine.sync();
    const third = a.engine.sync();
    await Promise.all([first, second, third]);
    expect(a.remote.calls.slice(calls)).toEqual(['push', 'pull', 'pull']);
  });
});

describe('temizlik ve tam eşitleme (X10)', () => {
  test('uzun süre eşitlenmeyen cihaz temizlenen silmeleri tam eşitlemeyle öğrenir', async () => {
    let serverNow = new Date();
    server = createFakeServer({ now: () => serverNow });
    const a = await device(server, 'u1');
    const b = await device(server, 'u1');
    await a.engine.start('u1');
    const x = await a.s().addTask({ title: 'X' });
    const y = await a.s().addTask({ title: 'Y' });
    await a.s().addTask({ title: 'Z' });
    await a.engine.sync();
    await b.engine.start('u1');

    await b.s().deleteTasks([x.id, y.id]);
    await b.engine.sync();
    serverNow = new Date(serverNow.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(server.purgeDeleted()).toBe(2);

    // A bu arada hiç eşitlemedi; Y'yi silmeden sonra düzenledi.
    await sleep(2);
    await a.s().updateTask(y.id, { title: 'Y düzenlendi' });
    await a.engine.sync();

    expect(a.titles()).toEqual(['Y düzenlendi', 'Z']);
    expect(a.s().tasks.find(t => t.id === x.id)).toBeUndefined(); // kalıcı silindi
    expect((await a.stored('tasks')).find(t => t.id === x.id)).toBeUndefined();

    await b.engine.sync();
    expect(b.titles()).toEqual(['Y düzenlendi', 'Z']);
  });

  test('tam eşitleme kuyrukta bekleyen (ör. reddedilmiş) kaydı silmez', async () => {
    let serverNow = new Date();
    server = createFakeServer({ now: () => serverNow });
    const a = await device(server, 'u1');
    const b = await device(server, 'u1');
    await a.engine.start('u1');
    const x = await a.s().addTask({ title: 'X' });
    await a.engine.sync();
    await b.engine.start('u1');
    await b.s().deleteTasks([x.id]);
    await b.engine.sync();
    serverNow = new Date(serverNow.getTime() + 31 * 24 * 60 * 60 * 1000);
    server.purgeDeleted();

    quietWarnings();
    const bad = await a.s().addTask({ title: 'bozuk' });
    a.store.setState(st => ({ tasks: st.tasks.map(t => (t.id === bad.id ? { ...t, priority: 7 } : t)) }));
    expect(await a.engine.sync()).toMatchObject({ phase: 'idle', blocked: 1 });

    expect(a.s().tasks.find(t => t.id === x.id)).toBeUndefined();
    expect(a.s().tasks.find(t => t.id === bad.id)).toBeDefined();
  });

  test('temizlik sınırının gerisinde olmayan cihaz tam eşitleme yapmaz', async () => {
    let serverNow = new Date();
    server = createFakeServer({ now: () => serverNow });
    const a = await device(server, 'u1');
    await a.engine.start('u1');
    const x = await a.s().addTask({ title: 'X' });
    await a.s().deleteTasks([x.id]);
    await a.engine.sync();
    serverNow = new Date(serverNow.getTime() + 31 * 24 * 60 * 60 * 1000);
    server.purgeDeleted();

    const calls = a.remote.calls.length;
    await a.engine.sync();
    expect(a.remote.calls.slice(calls)).toEqual(['pull']);
    // Silinmiş kayıt yerelde durur; yerel temizlik (açılışta) kendi süresiyle siler.
    expect(a.s().tasks.find(t => t.id === x.id)).toBeDefined();
  });
});

describe('kopyaları önleme (X13, X14)', () => {
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  test('tekrarlayan görev iki cihazda çevrimdışı tamamlanınca tek sonraki görev oluşur', async () => {
    const a = await device(server, 'u1');
    const b = await device(server, 'u1');
    await a.engine.start('u1');
    const tag = await a.s().findOrCreateTag('ev');
    const task = await a.s().addTask({ title: 'Çiçek sula', dueDate: today(), recurrence: { unit: 'day' }, tagIds: [tag.id] });
    await a.engine.sync();
    await b.engine.start('u1');

    await a.s().toggleTask(task.id);
    await sleep(2);
    await b.s().toggleTask(task.id);
    await a.engine.sync();
    await b.engine.sync();
    await a.engine.sync();

    for (const d of [a, b]) {
      const live = liveRecords(d.s().tasks);
      expect(live).toHaveLength(2);
      const next = live.find(t => t.id !== task.id);
      expect(liveRecords(d.s().taskTags).filter(l => l.taskId === next.id)).toHaveLength(1);
    }
  });

  test('iki cihazda aynı adla oluşturulan etiketler tek etikette birleşir', async () => {
    const a = await device(server, 'u1');
    const b = await device(server, 'u1');
    await a.engine.start('u1');
    await b.engine.start('u1');

    const tagA = await a.s().findOrCreateTag('İş');
    await a.s().addTask({ title: 'A', tagIds: [tagA.id] });
    await sleep(2);
    const tagB = await b.s().findOrCreateTag('iş');
    await b.s().addTask({ title: 'B', tagIds: [tagB.id] });

    await a.engine.sync();
    await b.engine.sync();
    await a.engine.sync();

    for (const d of [a, b]) {
      expect(liveRecords(d.s().tags).map(t => t.id)).toEqual([tagA.id]);
      const links = liveRecords(d.s().taskTags);
      expect(links).toHaveLength(2);
      expect(links.every(l => l.tagId === tagA.id)).toBe(true);
      expect(d.queue.size()).toBe(0);
    }
    expect(server.rows('u1', 'task_tags').filter(r => !r.deleted_at)).toHaveLength(2);
  });
});

describe('çıkış ve hesap silme (X3, X11)', () => {
  test('bekleyen değişiklik varsa çıkış önce uyarır; zorlanınca yerel veri silinir', async () => {
    const a = await device(server, 'u1');
    await a.s().updateSettings({ theme: 'dark' });
    await a.engine.start('u1');
    a.remote.online = false;
    await a.s().addTask({ title: 'gönderilmedi' });

    expect(await a.engine.signOut()).toEqual({ signedOut: false, pending: 1 });
    expect(a.titles()).toEqual(['gönderilmedi']);

    expect(await a.engine.signOut({ force: true })).toEqual({ signedOut: true, pending: 0 });
    expect(a.s().tasks).toEqual([]);
    expect(a.s().categories.map(c => c.id)).toEqual(['inbox']);
    expect(await a.stored('tasks')).toEqual([]);
    expect(await a.stored('syncState')).toBeNull();
    expect(a.queue.isActive()).toBe(false);
    expect(a.s().settings.theme).toBe('dark');
    expect(a.engine.getStatus()).toMatchObject({ phase: 'signedOut', userId: null });

    // Değişiklik yapınca kuyruk artık tutmaz; tekrar girişte veri sunucudan gelir.
    a.remote.online = true;
    await a.s().addTask({ title: 'girişsiz' });
    expect(a.queue.size()).toBe(0);
  });

  test('her şey gönderilmişse çıkış uyarısız; tekrar girişte veri geri gelir', async () => {
    const a = await device(server, 'u1');
    await a.engine.start('u1');
    await a.s().addTask({ title: 'kalıcı' });
    let signedOut = 0;
    a.remote.signOut = async () => { signedOut++; };

    expect(await a.engine.signOut()).toEqual({ signedOut: true, pending: 0 });
    expect(signedOut).toBe(1);
    expect(a.titles()).toEqual([]);

    await a.engine.start('u1');
    expect(a.titles()).toEqual(['kalıcı']);
  });

  test('hesabı sil: sunucu ve yerel veri silinir; sunucu hatasında hiçbir şey değişmez', async () => {
    const a = await device(server, 'u1');
    await a.engine.start('u1');
    await a.s().addTask({ title: 'x' });
    await a.engine.sync();

    a.remote.online = false;
    await expect(a.engine.deleteAccount()).rejects.toThrow('offline');
    expect(a.titles()).toEqual(['x']);
    expect(server.users.has('u1')).toBe(true);

    a.remote.online = true;
    await a.engine.deleteAccount();
    expect(server.users.has('u1')).toBe(false);
    expect(a.titles()).toEqual([]);
    expect(a.engine.getStatus().phase).toBe('signedOut');
  });

  test('çıkış sürmekte olan eşitlemeyi durdurur; silinen veri geri yazılmaz', async () => {
    const a = await device(server, 'u1');
    const b = await device(server, 'u1');
    await b.engine.start('u1');
    await b.s().addTask({ title: 'uzaktan' });
    await b.engine.sync();
    await a.engine.start('u1');

    let release;
    const pull = a.remote.pull;
    a.remote.pull = async (...args) => {
      await new Promise(r => { release = r; });
      return pull(...args);
    };
    const syncing = a.engine.sync();
    await sleep(5);
    await a.s().addTask({ title: 'arada' }); // eşitleme sürerken kuyruğa girer
    const calls = a.remote.calls.length;
    const signingOut = a.engine.signOut({ force: true });
    await sleep(5);
    release();
    await Promise.all([syncing, signingOut]);
    expect(a.titles()).toEqual([]);
    expect(a.engine.getStatus().phase).toBe('signedOut');
    // Yalnızca zaten başlamış çekme tamamlanır; çıkıştan sonra gönderim yapılmaz.
    expect(a.remote.calls.slice(calls)).toEqual(['pull']);
  });
});
