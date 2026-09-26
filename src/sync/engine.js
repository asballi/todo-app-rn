import { KEYS, readJson, writeJsonMany, removeKey } from '../data/storage';
import { SCHEMA_VERSION } from '../data/migrations';
import { useTodoStore } from '../store/useTodoStore';
import { syncQueue } from './queue';
import { isRemoteError } from './errors';
import { COLLECTIONS, toClientCollection, toClientRecord, toServerChanges } from './records';

// Senkron motoru (v4, docs/PLAN.md → X2, X3, X5, X6, X8, X10). Platformdan ve
// Supabase'den bağımsızdır; sunucuyla `remote` adaptörü üzerinden konuşur:
//
//   remote.push(clientSchema, changes)      → { written }            (supabase `push`)
//   remote.pull(clientSchema, since, lim)   → { records, next, has_more, purged_seq }
//   remote.deleteAccount()
//   remote.signOut?()                       → oturumu kapatır (isteğe bağlı)
//
// Hatalar RemoteError (errors.js) olarak gelir. Zamanlama (gecikme, yeniden deneme,
// Realtime) motorun dışındadır: çağıran sync()'i ne zaman isterse çalıştırır.
//
// Kalıcı durum (@todo/syncState): { userId, cursor, lastSyncedAt }

const EMPTY_STATE = { userId: null, cursor: 0, lastSyncedAt: null };

class Aborted extends Error {}

export function createSyncEngine({
  remote,
  store = useTodoStore,
  queue = syncQueue,
  schemaVersion = SCHEMA_VERSION,
  batchSize = 200,
  pageSize = 500,
  now = () => new Date(),
}) {
  let state = EMPTY_STATE;
  // phase: signedOut | idle | syncing | error | outdated
  let status = { phase: 'signedOut', error: null, errorKind: null };
  const listeners = new Set();
  let running = null;
  let again = false;
  // Çıkışta artar: sürmekte olan bir eşitleme silinen verinin üzerine yazmasın.
  let epoch = 0;

  const actions = () => store.getState();

  function getStatus() {
    return {
      ...status,
      userId: state.userId,
      lastSyncedAt: state.lastSyncedAt,
      pending: queue.size(),
      blocked: queue.blockedCount(),
    };
  }

  function setStatus(changes) {
    status = { ...status, ...changes };
    const snapshot = getStatus();
    for (const listener of listeners) listener(snapshot);
  }

  async function saveState(changes) {
    state = { ...state, ...changes };
    await writeJsonMany([[KEYS.syncState, state]]);
  }

  function guard(runEpoch) {
    if (runEpoch !== epoch) throw new Aborted();
  }

  // --- Gönderme ---

  function findLocal(collection, id) {
    return actions()[collection].find(r => r.id === id);
  }

  async function pushItems(items, runEpoch) {
    const present = items.filter(i => findLocal(i.collection, i.id));
    // Kuyrukta olup yerelde olmayan kayıt kalmamalı; varsa gönderilecek bir şey yok.
    const missing = items.filter(i => !present.includes(i));
    if (missing.length) await queue.ack(missing);
    if (present.length === 0) return;

    const changes = {};
    for (const { collection, id } of present) {
      (changes[collection] ??= []).push(findLocal(collection, id));
    }
    try {
      await remote.push(schemaVersion, toServerChanges(changes));
    } catch (e) {
      if (!isRemoteError(e, 'rejected')) throw e;
      guard(runEpoch);
      // Kısıta uymayan kayıt tüm gönderimi reddeder: ikiye bölerek bulunur,
      // yalnızca o kayıt engellenir, diğerleri gönderilir.
      if (present.length === 1) {
        console.warn('Senkron: kayıt sunucu tarafından reddedildi', present[0], e.message);
        await queue.block(present);
        return;
      }
      const mid = Math.ceil(present.length / 2);
      await pushItems(present.slice(0, mid), runEpoch);
      await pushItems(present.slice(mid), runEpoch);
      return;
    }
    guard(runEpoch);
    // Yazılanlar da, sunucuda daha yenisi olduğu için yazılmayanlar da kuyruktan çıkar;
    // daha yenisi çekmede gelir.
    await queue.ack(present);
  }

  async function pushAll(runEpoch) {
    const items = queue.snapshot();
    for (let i = 0; i < items.length; i += batchSize) {
      await pushItems(items.slice(i, i + batchSize), runEpoch);
    }
  }

  // --- Çekme ---

  async function applyPage(page) {
    const changes = {};
    for (const { collection, record } of page.records) {
      const clientCollection = toClientCollection(collection);
      if (!clientCollection) continue;
      (changes[clientCollection] ??= []).push(toClientRecord(clientCollection, record));
    }
    await actions().applyRemote(changes);
    return changes;
  }

  async function pullPages(since, runEpoch, onPage) {
    let cursor = since;
    for (;;) {
      const page = await remote.pull(schemaVersion, cursor, pageSize);
      guard(runEpoch);
      const result = await onPage(page, cursor);
      if (result === 'restart') return 'restart';
      cursor = page.next;
      await saveState({ cursor });
      if (!page.has_more) return cursor;
    }
  }

  async function pullAll(runEpoch) {
    const since = state.cursor;
    const result = await pullPages(since, runEpoch, async (page, cursor) => {
      // İmleç sunucunun temizlik sınırının gerisindeyse bazı silmeler kaçırılmış
      // olabilir → tam eşitleme (X10). İlk girişte (imleç 0) zaten her şey çekilir.
      if (cursor === since && since > 0 && page.purged_seq > since) return 'restart';
      await applyPage(page);
      return null;
    });
    if (result === 'restart') await fullResync(runEpoch);
  }

  // Her şeyi baştan çeker. Yerelde olup sunucuda olmayan ve kuyrukta olmayan
  // kayıtlar başka cihazda silinip temizlenmiştir; kalıcı silinir. Kuyruktakiler
  // silmeden daha yeni düzenlemelerdir ve normal gönderilir.
  async function fullResync(runEpoch) {
    const seen = Object.fromEntries(COLLECTIONS.map(c => [c, new Set()]));
    await pullPages(0, runEpoch, async page => {
      const changes = await applyPage(page);
      for (const [collection, records] of Object.entries(changes)) {
        for (const record of records) seen[collection].add(record.id);
      }
      return null;
    });
    guard(runEpoch);
    const removed = {};
    for (const collection of COLLECTIONS) {
      removed[collection] = actions()[collection]
        .filter(r => !seen[collection].has(r.id) && !queue.has(collection, r.id))
        .map(r => r.id);
    }
    await actions().removeRecords(removed);
  }

  // --- Eşitleme ---

  async function runOnce() {
    const runEpoch = epoch;
    setStatus({ phase: 'syncing' });
    try {
      await pushAll(runEpoch);
      await pullAll(runEpoch);
      // Aynı adlı etiketler (X14): birleştirme yerel bir değişikliktir, gönderilir.
      await actions().mergeDuplicateTags();
      if (queue.snapshot().length) await pushAll(runEpoch);
      guard(runEpoch);
      await saveState({ lastSyncedAt: now().toISOString() });
      setStatus({ phase: 'idle', error: null, errorKind: null });
    } catch (e) {
      if (e instanceof Aborted) return;
      if (isRemoteError(e, 'outdated')) {
        setStatus({ phase: 'outdated', error: e.message, errorKind: 'outdated' });
      } else {
        const errorKind = isRemoteError(e) ? e.kind : 'unknown';
        if (errorKind === 'unknown') console.warn('Senkron hatası', e);
        setStatus({ phase: 'error', error: e.message, errorKind });
      }
    }
  }

  // Aynı anda tek eşitleme çalışır; sürerken gelen istek bittiğinde bir kez daha çalıştırır.
  function sync() {
    if (!state.userId) return Promise.resolve(getStatus());
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          await runOnce();
        } while (again && state.userId);
      } finally {
        running = null;
      }
      return getStatus();
    })();
    return running;
  }

  async function wipe() {
    // Sürmekte olan eşitleme bir sonraki adımında durur ve yeniden başlamaz.
    epoch++;
    again = false;
    state = { ...state, userId: null };
    await running;
    await queue.reset();
    await actions().resetLocalData();
    state = EMPTY_STATE;
    await removeKey(KEYS.syncState);
    setStatus({ phase: 'signedOut', error: null, errorKind: null });
  }

  return {
    getStatus,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    // Açılışta: kayıtlı durumu yükler. Dönüş: girişli kullanıcının kimliği ya da null.
    async load() {
      state = { ...EMPTY_STATE, ...(await readJson(KEYS.syncState, EMPTY_STATE)) };
      setStatus({ phase: state.userId ? 'idle' : 'signedOut' });
      return state.userId;
    },

    // Girişte ve açılışta oturum varken. İlk kez (bu cihazda bu kullanıcıyla):
    // tüm yerel kayıtlar (silinmişler dahil) kuyruğa alınır, sunucudaki her şey
    // çekilir ve "son güncellenen kazanır" ile birleşir (X2).
    async start(userId) {
      if (state.userId && state.userId !== userId) {
        throw new Error('Başka bir hesap bu cihazda girişli; önce çıkış yapılmalı.');
      }
      if (state.userId !== userId) {
        // Sıra önemli: kuyruk dolmadan durum yazılırsa, arada kesilen bir girişten
        // sonra yerel kayıtlar hiç gönderilmezdi. Tekrar çalışması zararsızdır.
        await queue.activate();
        const all = actions();
        await queue.enqueue(Object.fromEntries(COLLECTIONS.map(c => [c, all[c]])));
        await saveState({ ...EMPTY_STATE, userId });
      }
      return sync();
    },

    sync,

    // Çıkış (X3): önce bir eşitleme denenir. Hâlâ gönderilmemiş değişiklik varsa ve
    // force verilmediyse hiçbir şey yapılmaz, sayısı döner (arayüz uyarı gösterir).
    // Sonra oturum kapanır ve yerel veri silinir (ayarlar kalır). force ile (kullanıcı
    // kaybı onayladıktan sonra) yeniden eşitleme beklenmez; sürmekte olan durdurulur.
    async signOut({ force = false } = {}) {
      if (state.userId && !force) await sync();
      const pending = queue.size();
      if (pending > 0 && !force) return { signedOut: false, pending };
      try {
        await remote.signOut?.();
      } catch (e) {
        console.warn('Oturum kapatılamadı', e);
      }
      await wipe();
      return { signedOut: true, pending: 0 };
    },

    // Hesabı sil (X11): sunucu silemezse yerelde hiçbir şey değişmez.
    async deleteAccount() {
      await remote.deleteAccount();
      try {
        await remote.signOut?.();
      } catch {}
      await wipe();
    },
  };
}
