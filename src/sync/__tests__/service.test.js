import { createFakeServer } from '../remote.fake';
import { liveRecords } from '../../domain/models';

// Cihaz yardımcısı engine.test.js ile aynı: her cihaz ayrı modül kopyası ve depo.
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

async function device(server, remote = server.createRemote()) {
  let mods;
  jest.isolateModules(() => {
    jest.doMock('@react-native-async-storage/async-storage', memoryStorage);
    mods = {
      store: require('../../store/useTodoStore').useTodoStore,
      queue: require('../queue').syncQueue,
      createSyncService: require('../service').createSyncService,
    };
  });
  await mods.store.getState().init();
  const make = () => mods.createSyncService({ remote, store: mods.store, queue: mods.queue });
  const service = make();
  const s = () => mods.store.getState();
  return {
    ...mods,
    remote,
    service,
    make,
    s,
    titles: () => liveRecords(s().tasks).map(t => t.title).sort(),
  };
}

const settle = () => new Promise(r => setTimeout(r, 0));

let server;
beforeEach(() => {
  server = createFakeServer();
});

async function signIn(d, email = 'ali@example.com') {
  await d.service.sendCode(email);
  return d.service.verifyCode(email, '123456');
}

test('girişsiz başlar; kod doğrulanınca yerel veri hesaba yüklenir', async () => {
  const a = await device(server);
  await a.s().addTask({ title: 'yerel' });
  await a.service.init();
  expect(a.service.getState()).toMatchObject({ ready: true, signedIn: false, sessionExpired: false, email: null });

  await signIn(a);
  a.service.setForeground(false);
  expect(a.service.getState()).toMatchObject({ signedIn: true, email: 'ali@example.com' });
  expect(a.service.getState().sync).toMatchObject({ phase: 'idle', pending: 0 });
  const userId = server.userIdFor('ali@example.com');
  expect(server.rows(userId, 'tasks').map(r => r.title)).toEqual(['yerel']);
});

test('hatalı kod reddedilir, hiçbir şey başlamaz', async () => {
  const a = await device(server);
  await a.service.init();
  await a.service.sendCode('ali@example.com');
  await expect(a.service.verifyCode('ali@example.com', '000000')).rejects.toMatchObject({ kind: 'invalidCode' });
  expect(a.service.getState()).toMatchObject({ signedIn: false, email: null });
  expect(a.queue.isActive()).toBe(false);
});

test('yerel değişiklik zamanlayıcıyla gönderilir, diğer cihaz Realtime sinyaliyle çeker', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  try {
    const a = await device(server);
    const b = await device(server);
    await a.service.init();
    await b.service.init();
    await signIn(a);
    await signIn(b);
    await jest.advanceTimersByTimeAsync(10);

    await a.s().addTask({ title: 'anlık' });
    expect(a.service.getState().sync.pending).toBe(1);
    await jest.advanceTimersByTimeAsync(999);
    expect(b.titles()).toEqual([]);
    await jest.advanceTimersByTimeAsync(1); // A gönderir (1 sn)
    await jest.advanceTimersByTimeAsync(300); // B sinyali alır ve çeker (250 ms)
    expect(b.titles()).toEqual(['anlık']);
    expect(a.service.getState().sync.pending).toBe(0);

    a.service.setForeground(false);
    b.service.setForeground(false);
  } finally {
    jest.useRealTimers();
  }
});

test('çıkış: bekleyen varsa uyarı, zorlanınca silinir; tekrar girişte veri döner', async () => {
  const a = await device(server);
  await a.service.init();
  await signIn(a);
  a.service.setForeground(false);
  await a.s().addTask({ title: 'gönderildi' });
  await a.service.syncNow();

  a.remote.online = false;
  await a.s().addTask({ title: 'bekleyen' });
  expect(await a.service.signOut()).toEqual({ signedOut: false, pending: 1 });
  expect(a.service.getState().signedIn).toBe(true);

  expect(await a.service.signOut({ force: true })).toEqual({ signedOut: true, pending: 0 });
  expect(a.service.getState()).toMatchObject({ signedIn: false, email: null, sessionExpired: false });
  expect(a.titles()).toEqual([]);

  a.remote.online = true;
  await signIn(a);
  a.service.setForeground(false);
  expect(a.titles()).toEqual(['gönderildi']);
});

test('oturum düşerse cihaz hesaba bağlı kalır; aynı hesapla yeniden girişte devam eder', async () => {
  const a = await device(server);
  await a.service.init();
  await signIn(a);
  a.service.setForeground(false);
  a.remote.expireSession();
  expect(a.service.getState()).toMatchObject({ signedIn: false, sessionExpired: true });

  await a.s().addTask({ title: 'oturumsuz' }); // kuyrukta bekler
  await signIn(a);
  a.service.setForeground(false);
  expect(a.service.getState()).toMatchObject({ signedIn: true, sessionExpired: false });
  expect(server.rows(server.userIdFor('ali@example.com'), 'tasks').map(r => r.title)).toEqual(['oturumsuz']);
});

test('oturum düşmüşken başka hesapla giriş reddedilir', async () => {
  const a = await device(server);
  await a.service.init();
  await signIn(a);
  a.service.setForeground(false);
  a.remote.expireSession();
  await expect(signIn(a, 'veli@example.com')).rejects.toThrow('önce');
  expect(a.service.getState()).toMatchObject({ signedIn: false, sessionExpired: true, email: null });
});

test('açılışta kayıtlı oturumla kaldığı yerden devam eder', async () => {
  const remote = server.createRemote();
  const a = await device(server, remote);
  await a.service.init();
  await signIn(a);
  a.service.setForeground(false);

  // Uygulama yeniden açıldı: aynı depo, yeni servis
  const again = a.make();
  await again.init();
  again.setForeground(false);
  expect(again.getState()).toMatchObject({ ready: true, signedIn: true, email: 'ali@example.com' });
});

test('giriş yarıda kaldıysa (oturum var, motor başlamamış) açılışta tamamlanır', async () => {
  const remote = server.createRemote();
  await remote.sendCode('ali@example.com');
  await remote.verifyCode('ali@example.com', '123456'); // oturum açıldı ama motor hiç başlamadı
  const a = await device(server, remote);
  await a.s().addTask({ title: 'yarım' });
  await a.service.init();
  a.service.setForeground(false);
  expect(a.service.getState().signedIn).toBe(true);
  expect(server.rows(server.userIdFor('ali@example.com'), 'tasks').map(r => r.title)).toEqual(['yarım']);
});

test('hesabı sil', async () => {
  const a = await device(server);
  await a.service.init();
  await signIn(a);
  a.service.setForeground(false);
  await a.s().addTask({ title: 'x' });
  await a.service.syncNow();

  await a.service.deleteAccount();
  await settle();
  expect(a.service.getState()).toMatchObject({ signedIn: false, email: null });
  expect(a.titles()).toEqual([]);
  expect(server.users.size).toBe(0);
});
