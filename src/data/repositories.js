import { KEYS, readJson, writeJsonMany, withKeyLock } from './storage';

// Her koleksiyon için aynı arayüz: list(), upsertMany(records), removeMany(ids), replaceAll(records).
// Silme, deletedAt alanı dolu bir kaydın upsert edilmesidir (soft delete);
// removeMany yalnızca süresi dolmuş silinmiş kayıtların temizliği içindir.
// v4'te bu arayüzün arkasına Supabase konabilir; store'un değişmesi gerekmez.
function createCollectionRepository(key) {
  return {
    list() {
      return readJson(key, []);
    },
    upsertMany(records) {
      if (records.length === 0) return Promise.resolve();
      return withKeyLock(key, async () => {
        const byId = new Map((await readJson(key, [])).map(r => [r.id, r]));
        for (const record of records) byId.set(record.id, record);
        await writeJsonMany([[key, [...byId.values()]]]);
      });
    },
    // Koleksiyonun tamamını değiştirir (çıkışta yerel verinin sıfırlanması).
    replaceAll(records) {
      return withKeyLock(key, () => writeJsonMany([[key, records]]));
    },
    removeMany(ids) {
      if (ids.length === 0) return Promise.resolve();
      return withKeyLock(key, async () => {
        const removed = new Set(ids);
        await writeJsonMany([[key, (await readJson(key, [])).filter(r => !removed.has(r.id))]]);
      });
    },
  };
}

// Ayarlar tek bir nesnedir; kayıtlı değerler varsayılanların üzerine yazılır.
export const settingsRepository = {
  async get(defaults) {
    return { ...defaults, ...(await readJson(KEYS.settings, {})) };
  },
  save(settings) {
    return withKeyLock(KEYS.settings, () => writeJsonMany([[KEYS.settings, settings]]));
  },
};

export const taskRepository = createCollectionRepository(KEYS.tasks);
export const categoryRepository = createCollectionRepository(KEYS.categories);
export const tagRepository = createCollectionRepository(KEYS.tags);
export const taskTagRepository = createCollectionRepository(KEYS.taskTags);
