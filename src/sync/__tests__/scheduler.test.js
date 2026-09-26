import { createSyncScheduler } from '../scheduler';

beforeEach(() => jest.useFakeTimers({ now: new Date('2026-09-25T10:00:00Z') }));
afterEach(() => jest.useRealTimers());

function setup(results = []) {
  const calls = [];
  const sync = jest.fn(async () => {
    calls.push(Date.now());
    return results.length ? results.shift() : { phase: 'idle' };
  });
  const scheduler = createSyncScheduler({ sync });
  return { sync, scheduler, calls };
}

// Zamanlayıcıları ilerletir ve bekleyen sözlerin çözülmesini sağlar. Not: sahte
// zamanlayıcılar başka bir zamanlayıcının içinden kurulan 0 ms'yi 1 ms sayar.
async function advance(ms) {
  await jest.advanceTimersByTimeAsync(ms);
}

test('başlatınca hemen, sonra dakikada bir eşitler', async () => {
  const { sync, scheduler } = setup();
  scheduler.start();
  await advance(0);
  expect(sync).toHaveBeenCalledTimes(1);
  await advance(60_001);
  expect(sync).toHaveBeenCalledTimes(2);
  await advance(60_000);
  expect(sync).toHaveBeenCalledTimes(3);
  scheduler.stop();
  await advance(120_000);
  expect(sync).toHaveBeenCalledTimes(3);
});

test('başlatılmadan hiçbir şey çalışmaz', async () => {
  const { sync, scheduler } = setup();
  scheduler.localChange();
  scheduler.now();
  await advance(10_000);
  expect(sync).not.toHaveBeenCalled();
});

test('yerel değişiklikler ilkinden 1 sn sonra toplu gider; yazarken ertelenmez', async () => {
  const { sync, scheduler } = setup();
  scheduler.start();
  await advance(0);
  sync.mockClear();
  scheduler.localChange();
  await advance(400);
  scheduler.localChange();
  await advance(400);
  scheduler.localChange();
  await advance(199);
  expect(sync).not.toHaveBeenCalled();
  await advance(1);
  expect(sync).toHaveBeenCalledTimes(1);
});

test('uzak sinyal 250 ms içinde çeker; daha erken istek geç olanın yerini alır', async () => {
  const { sync, scheduler } = setup();
  scheduler.start();
  await advance(0);
  sync.mockClear();
  scheduler.localChange(); // 1000 ms
  scheduler.remoteChange(); // 250 ms: daha erken
  await advance(250);
  expect(sync).toHaveBeenCalledTimes(1);
  await advance(1000);
  expect(sync).toHaveBeenCalledTimes(1);
});

test('ağ hatasında artan beklemeyle yeniden dener, başarıda sıfırlanır', async () => {
  const error = { phase: 'error', errorKind: 'network' };
  const { calls, scheduler } = setup([error, error, error, { phase: 'idle' }, error]);
  const start = Date.now();
  scheduler.start();
  await advance(0);
  await advance(5_000);
  await advance(10_000);
  await advance(20_000); // başarı
  expect(calls.map(t => (t - start) / 1000)).toEqual([0, 5, 15, 35]);
  scheduler.now();
  await advance(0); // hata: bekleme baştan
  await advance(5_000);
  expect(calls.map(t => (t - start) / 1000)).toEqual([0, 5, 15, 35, 35, 40]);
});

test('sürüm kilidi ve oturum hatası hızlı yeniden denenmez', async () => {
  const { sync, scheduler } = setup([{ phase: 'outdated' }, { phase: 'error', errorKind: 'unauthenticated' }]);
  scheduler.start();
  await advance(0);
  await advance(30_000);
  expect(sync).toHaveBeenCalledTimes(1);
  await advance(30_001); // dakikalık tur
  expect(sync).toHaveBeenCalledTimes(2);
  await advance(30_000);
  expect(sync).toHaveBeenCalledTimes(2);
});
