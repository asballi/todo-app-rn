import { useTodoStore } from '../store/useTodoStore';
import { strings } from '../strings';
import { createSyncEngine } from './engine';
import { createSyncScheduler } from './scheduler';
import { syncQueue } from './queue';

// Motoru, zamanlayıcıyı, oturumu ve Realtime'ı bir araya getirir; arayüz yalnızca
// bununla konuşur. `remote` motorun arayüzüne ek olarak girişi de sağlar:
//   sendCode(email), verifyCode(email, code) → { userId, email },
//   getSession(), onSessionChange(listener), signOut(),
//   subscribeChanges(userId, listener) → unsubscribe, setAutoRefresh?(active)
//
// Durum (getState):
//   ready          → init tamamlandı
//   email          → oturumdaki hesap (yoksa null)
//   signedIn       → oturum var ve bu cihaz o hesapla eşitleniyor
//   sessionExpired → bu cihaz bir hesaba bağlı ama oturum yok (yeniden giriş gerekir)
//   sync           → motor durumu (phase, pending, blocked, lastSyncedAt, error…)

export function createSyncService({
  remote,
  store = useTodoStore,
  queue = syncQueue,
  engineOptions = {},
  scheduleOptions = {},
}) {
  const engine = createSyncEngine({ remote, store, queue, ...engineOptions });
  const scheduler = createSyncScheduler({ sync: engine.sync, options: scheduleOptions });
  const listeners = new Set();
  let session = null;
  let ready = false;
  let attachedUser = null;
  let unsubscribeRealtime = null;
  let foreground = true;
  let snapshot = null;

  function computeState() {
    const sync = engine.getStatus();
    return {
      ready,
      email: session?.email ?? null,
      signedIn: Boolean(session && attachedUser === session.userId),
      sessionExpired: Boolean(sync.userId && !session),
      sync,
    };
  }

  function emit() {
    snapshot = computeState();
    for (const listener of listeners) listener(snapshot);
  }

  // Oturum ile motorun hesabı aynıysa: zamanlayıcı ve Realtime çalışır.
  function attach(userId) {
    if (attachedUser === userId) return;
    detach();
    attachedUser = userId;
    unsubscribeRealtime = remote.subscribeChanges?.(userId, () => scheduler.remoteChange()) ?? null;
    if (foreground) scheduler.start();
  }

  function detach() {
    attachedUser = null;
    scheduler.stop();
    unsubscribeRealtime?.();
    unsubscribeRealtime = null;
  }

  const service = {
    engine,

    getState() {
      return snapshot ?? (snapshot = computeState());
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    // Uygulama açılışında, veriler yüklendikten sonra bir kez.
    async init() {
      if (ready) return;
      engine.subscribe(emit);
      queue.subscribe(() => {
        if (attachedUser) scheduler.localChange();
        emit();
      });
      const engineUser = await engine.load();
      session = await remote.getSession();
      if (session && engineUser && engineUser !== session.userId) {
        // Beklenmeyen durum: cihaz başka bir hesaba bağlı. O hesabın gönderilmemiş
        // verisi silinmesin diye oturum kapatılır; arayüz yeniden giriş ister.
        await remote.signOut().catch(() => {});
        session = null;
      }
      remote.onSessionChange?.(next => {
        session = next;
        if (!next) detach();
        emit();
      });
      if (session) {
        // engineUser yoksa giriş yarıda kalmıştır: start ilk birleştirmeyi yapar.
        if (!engineUser) await engine.start(session.userId);
        attach(session.userId);
      }
      ready = true;
      emit();
    },

    sendCode(email) {
      return remote.sendCode(email.trim());
    },

    // Kod doğrulanınca motor başlar (ilk girişte yerel veri hesapla birleşir).
    async verifyCode(email, code) {
      const next = await remote.verifyCode(email.trim(), code.trim());
      const engineUser = engine.getStatus().userId;
      if (engineUser && engineUser !== next.userId) {
        await remote.signOut().catch(() => {});
        session = null;
        emit();
        throw new Error(strings.account.otherAccount);
      }
      session = next;
      emit();
      const status = await engine.start(next.userId);
      attach(next.userId);
      emit();
      return status;
    },

    syncNow() {
      return engine.sync();
    },

    // Dönüş: { signedOut, pending } — pending > 0 ise arayüz onay ister, sonra force ile.
    async signOut({ force = false } = {}) {
      const result = await engine.signOut({ force });
      if (result.signedOut) {
        detach();
        session = null;
      }
      emit();
      return result;
    },

    async deleteAccount() {
      await engine.deleteAccount();
      detach();
      session = null;
      emit();
    },

    // Uygulama öne gelince / arka plana geçince (AppState).
    setForeground(active) {
      foreground = active;
      remote.setAutoRefresh?.(active);
      if (!attachedUser) return;
      if (active) {
        scheduler.start();
        scheduler.now();
      } else {
        scheduler.stop();
      }
    },
  };
  return service;
}
