import { SCHEMA_VERSION } from './migrations';
import { withTaskDefaults, isAlive } from '../domain/models';
import { strings } from '../strings';

// Yedek dosyası: { app, schemaVersion, exportedAt, data: { tasks, categories, tags, taskTags, settings } }
// Silinmiş (deletedAt dolu) kayıtlar da dahildir; aksi halde birleştirmede
// başka cihazda silinen bir kayıt geri gelirdi.

export const BACKUP_APP = 'todoapp';
export const COLLECTIONS = ['tasks', 'categories', 'tags', 'taskTags'];
const MIN_SCHEMA_VERSION = 2;
const e = strings.errors;

export function buildBackup(state, now = new Date()) {
  const data = Object.fromEntries(COLLECTIONS.map(c => [c, state[c]]));
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data: { ...data, settings: state.settings } };
}

export function backupFileName(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `yapilacaklar-yedek-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

// Metni doğrular ve güncel biçime çevirir. Hatalıysa (bozuk, başka uygulama,
// daha yeni sürüm) hata fırlatır; hiçbir şey değiştirilmez.
export function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error(e.backupInvalid);
  }
  if (!backup || backup.app !== BACKUP_APP || typeof backup.data !== 'object' || backup.data === null) {
    throw new Error(e.backupInvalid);
  }
  const version = backup.schemaVersion;
  if (!Number.isInteger(version) || version < MIN_SCHEMA_VERSION) throw new Error(e.backupInvalid);
  if (version > SCHEMA_VERSION) throw new Error(e.backupTooNew);

  const data = {};
  for (const collection of COLLECTIONS) {
    const records = backup.data[collection] ?? [];
    if (!Array.isArray(records) || records.some(r => !r || typeof r.id !== 'string' || typeof r.updatedAt !== 'string')) {
      throw new Error(e.backupInvalid);
    }
    data[collection] = records;
  }
  // Eski sürüm yedekler güncel biçime çevrilir (şema 2 → 3: yeni görev alanları).
  if (version < 3) data.tasks = data.tasks.map(withTaskDefaults);
  return { ...backup, schemaVersion: SCHEMA_VERSION, data };
}

// Yedeği mevcut verilerle kimliğe göre birleştirir; updatedAt daha yeni olan kazanır.
// Aynı adda farklı kimlikli etiketler mevcut etikete bağlanır, aynı görev-etiket
// bağı ikinci kez eklenmez.
// Dönüş: { changes: { [collection]: records }, summary: { [collection]: { added, updated, deleted } } }
// Özet kullanıcının göreceğini sayar: silinmiş olarak gelen yeni kayıtlar
// "eklenen" sayılmaz; canlı bir kaydı silen güncelleme "silinen" sayılır.
export function mergeBackup(current, backup) {
  const incoming = { ...backup.data };
  const changes = {};
  const summary = {};

  // Aynı ada sahip etiketler: yedektekini mevcut olana eşle.
  const tagIdMap = new Map();
  const localTagsByKey = new Map(current.tags.filter(isAlive).map(t => [t.nameKey, t]));
  incoming.tags = incoming.tags.filter(tag => {
    const local = localTagsByKey.get(tag.nameKey);
    if (isAlive(tag) && local && local.id !== tag.id && !current.tags.some(t => t.id === tag.id)) {
      tagIdMap.set(tag.id, local.id);
      return false;
    }
    return true;
  });
  const liveLinkKeys = new Set(current.taskTags.filter(isAlive).map(l => `${l.taskId}|${l.tagId}`));
  incoming.taskTags = incoming.taskTags
    .map(link => (tagIdMap.has(link.tagId) ? { ...link, tagId: tagIdMap.get(link.tagId) } : link))
    .filter(link => !(isAlive(link) && liveLinkKeys.has(`${link.taskId}|${link.tagId}`) && !current.taskTags.some(l => l.id === link.id)));

  for (const collection of COLLECTIONS) {
    const byId = new Map(current[collection].map(r => [r.id, r]));
    const accepted = [];
    const counts = { added: 0, updated: 0, deleted: 0 };
    for (const record of incoming[collection]) {
      const existing = byId.get(record.id);
      if (existing && record.updatedAt <= existing.updatedAt) continue;
      accepted.push(record);
      if (!existing) {
        if (isAlive(record)) counts.added += 1;
      } else if (!isAlive(record) && isAlive(existing)) {
        counts.deleted += 1;
      } else if (isAlive(record)) {
        counts.updated += 1;
      }
    }
    changes[collection] = accepted;
    summary[collection] = counts;
  }
  return { changes, summary };
}

export function hasChanges(changes) {
  return Object.values(changes).some(records => records.length > 0);
}
