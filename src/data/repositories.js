import { KEYS, readJson, writeJsonMany, withKeyLock } from './storage';

// Her koleksiyon için aynı arayüz: list() ve upsertMany(records).
// Silme, deletedAt alanı dolu bir kaydın upsert edilmesidir (soft delete).
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
  };
}

export const taskRepository = createCollectionRepository(KEYS.tasks);
export const categoryRepository = createCollectionRepository(KEYS.categories);
export const tagRepository = createCollectionRepository(KEYS.tags);
export const taskTagRepository = createCollectionRepository(KEYS.taskTags);
