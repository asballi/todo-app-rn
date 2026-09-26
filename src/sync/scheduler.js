// Senkronun ne zaman çalışacağı (X5). Motor yalnızca sync() sunar; burada:
//   - yerel değişiklikten sonra en geç 1 sn içinde (yazarken her tuşta ertelenmez,
//     ilk bekleyen değişiklikten 1 sn sonra toplu gider)
//   - Realtime "değişti" sinyalinden 250 ms sonra (arka arkaya gelenler birleşir)
//   - açılışta, öne gelince, "Şimdi eşitle"de hemen
//   - açıkken dakikada bir
//   - ağ / sunucu hatasında artan beklemeyle yeniden (5 sn → 5 dk); başarıda sıfırlanır.
//     Sürüm kilidi (outdated) ve oturum hatası yeniden denenmez (dakikalık tur sürer).
// Birden fazla istek aynı anda beklerse en erken olanı geçerlidir.

export const SCHEDULE = {
  localDelay: 1000,
  remoteDelay: 250,
  pullInterval: 60 * 1000,
  retryDelays: [5, 10, 20, 40, 80, 160, 300].map(s => s * 1000),
};

export function createSyncScheduler({ sync, options = SCHEDULE }) {
  const { localDelay, remoteDelay, pullInterval, retryDelays } = { ...SCHEDULE, ...options };
  let active = false;
  let timer = null;
  let dueAt = Infinity;
  let interval = null;
  let failures = 0;

  function schedule(delay) {
    if (!active) return;
    const at = Date.now() + delay;
    if (timer && dueAt <= at) return;
    clearTimeout(timer);
    dueAt = at;
    timer = setTimeout(run, delay);
  }

  async function run() {
    timer = null;
    dueAt = Infinity;
    const status = await sync();
    if (!active) return;
    if (status?.phase === 'error' && status.errorKind !== 'unauthenticated') {
      schedule(retryDelays[Math.min(failures, retryDelays.length - 1)]);
      failures++;
    } else {
      failures = 0;
    }
  }

  return {
    start() {
      if (active) return;
      active = true;
      interval = setInterval(() => schedule(0), pullInterval);
      schedule(0);
    },
    stop() {
      active = false;
      clearTimeout(timer);
      clearInterval(interval);
      timer = null;
      interval = null;
      dueAt = Infinity;
      failures = 0;
    },
    localChange: () => schedule(localDelay),
    remoteChange: () => schedule(remoteDelay),
    now: () => schedule(0),
    isActive: () => active,
  };
}
