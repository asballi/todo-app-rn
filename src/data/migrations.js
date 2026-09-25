import { KEYS, readJson, writeJsonMany, removeKey } from './storage';
import { createInbox, createTask, withTaskDefaults } from '../domain/models';
import { nowIso } from '../domain/ids';

export const SCHEMA_VERSION = 3;

// Sürüm 1: tek '@todos' anahtarında [{ id, text, done }].
// Sürüm 2: normalize koleksiyonlar + Gelen Kutusu.
// Sürüm 3: görevlere reminders, recurrence, nextTaskId, checklist alanları.
export async function runMigrations(now = new Date()) {
  const version = await readJson(KEYS.schemaVersion, 1);

  if (version < 2) {
    await migrateToV2(now);
  }
  if (version < 3) {
    await migrateToV3();
  }

  // Eski anahtar, yeni veriler yazıldıktan sonra silinir. Önceki çalıştırma
  // silmeden önce kesildiyse burada temizlenir.
  if ((await readJson(KEYS.schemaVersion, 1)) >= 2) {
    await removeKey(KEYS.legacyTodos);
  }
}

async function migrateToV2(now) {
  let legacy = [];
  try {
    legacy = await readJson(KEYS.legacyTodos, []);
  } catch (e) {
    // Okunamayan eski veri silinmesin diye taşımayı durdur.
    throw new Error(`Eski görevler okunamadı: ${e.message}`);
  }
  if (!Array.isArray(legacy)) legacy = [];

  const tasks = legacy
    .filter(t => t && typeof t.text === 'string' && t.text.trim())
    .map(t => {
      const task = createTask({ title: t.text }, now);
      // Eski ID, oluşturulma anının Date.now() değeriydi.
      const created = new Date(t.id);
      if (Number.isFinite(created.getTime())) task.createdAt = nowIso(created);
      if (t.done) task.completedAt = nowIso(now);
      return task;
    });

  // Tüm koleksiyonlar ve sürüm tek çağrıda yazılır; yarıda kalan bir taşıma
  // sürümü 2 yapmadığı için bir sonraki açılışta baştan tekrarlanır.
  await writeJsonMany([
    [KEYS.tasks, tasks],
    [KEYS.categories, [createInbox(now)]],
    [KEYS.tags, []],
    [KEYS.taskTags, []],
    [KEYS.schemaVersion, 2],
  ]);
}

async function migrateToV3() {
  const tasks = await readJson(KEYS.tasks, []);
  await writeJsonMany([
    [KEYS.tasks, tasks.map(withTaskDefaults)],
    [KEYS.schemaVersion, 3],
  ]);
}
