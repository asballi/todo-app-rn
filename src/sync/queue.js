import { KEYS, readJson, writeJsonMany, withKeyLock } from '../data/storage';

// Gönderme kuyruğu (v4): sunucuya henüz gönderilmemiş yerel değişiklikler.
// Kaydın kendisi değil yalnızca kimliği tutulur; gönderilen her zaman kaydın
// en son hâlidir. Kuyruk yalnızca girişliyken etkindir (active); girişsiz
// yapılan değişiklikler ilk girişte zaten toplu gönderilir.
//
// Her eklemede kayda artan bir sıra numarası verilir. Gönderim sürerken aynı
// kayıt yeniden değişirse numarası büyür ve ack onu kuyruktan çıkarmaz.
//
// Sunucunun kısıt nedeniyle reddettiği kayıtlar "engelli" olarak kuyrukta kalır:
// gönderilmez ama bekleyen değişiklik sayılır (çıkışta uyarı) ve tam eşitlemede
// silinmez. Kayıt yeniden değişince engel kalkar ve tekrar denenir.
//
// Depodaki biçim (@todo/syncQueue):
//   { active, seq, entries: { 'tasks/<id>': seq }, blocked: { 'tasks/<id>': seq } }

const EMPTY = { active: false, seq: 0, entries: {}, blocked: {} };
let state = EMPTY;

const entryKey = (collection, id) => `${collection}/${id}`;

function save() {
  return withKeyLock(KEYS.syncQueue, () => writeJsonMany([[KEYS.syncQueue, state]]));
}

export const syncQueue = {
  async load() {
    state = { ...EMPTY, ...(await readJson(KEYS.syncQueue, EMPTY)) };
  },

  isActive() {
    return state.active;
  },

  // Bekleyen tüm değişiklikler (engelliler dahil).
  size() {
    return Object.keys(state.entries).length + Object.keys(state.blocked).length;
  },

  blockedCount() {
    return Object.keys(state.blocked).length;
  },

  has(collection, id) {
    const key = entryKey(collection, id);
    return key in state.entries || key in state.blocked;
  },

  // changes: { [collection]: records } (store'un commit biçimi)
  enqueue(changes) {
    if (!state.active) return Promise.resolve();
    const entries = { ...state.entries };
    const blocked = { ...state.blocked };
    let { seq } = state;
    for (const [collection, records] of Object.entries(changes)) {
      for (const record of records) {
        const key = entryKey(collection, record.id);
        entries[key] = ++seq;
        delete blocked[key];
      }
    }
    if (seq === state.seq) return Promise.resolve();
    state = { ...state, seq, entries, blocked };
    return save();
  },

  // Gönderilecekler (engelliler hariç): [{ collection, id, seq }]
  snapshot() {
    return Object.entries(state.entries).map(([key, seq]) => {
      const slash = key.indexOf('/');
      return { collection: key.slice(0, slash), id: key.slice(slash + 1), seq };
    });
  },

  // Gönderilenleri çıkarır; o arada yeniden değişenler kalır.
  ack(items) {
    const entries = { ...state.entries };
    let changed = false;
    for (const { collection, id, seq } of items) {
      const key = entryKey(collection, id);
      if (entries[key] === seq) {
        delete entries[key];
        changed = true;
      }
    }
    if (!changed) return Promise.resolve();
    state = { ...state, entries };
    return save();
  },

  // Reddedilenleri engelli yapar; o arada yeniden değişenler gönderilecekler arasında kalır.
  block(items) {
    const entries = { ...state.entries };
    const blocked = { ...state.blocked };
    for (const { collection, id, seq } of items) {
      const key = entryKey(collection, id);
      if (entries[key] === seq) {
        delete entries[key];
        blocked[key] = seq;
      }
    }
    state = { ...state, entries, blocked };
    return save();
  },

  // Girişte: kuyruk etkinleşir.
  activate() {
    if (state.active) return Promise.resolve();
    state = { ...state, active: true };
    return save();
  },

  // Çıkışta: kuyruk boşalır ve devre dışı kalır.
  reset() {
    state = EMPTY;
    return save();
  },
};
