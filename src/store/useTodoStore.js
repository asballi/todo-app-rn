import { create } from 'zustand';
import { runMigrations } from '../data/migrations';
import {
  taskRepository,
  categoryRepository,
  tagRepository,
  taskTagRepository,
  settingsRepository,
} from '../data/repositories';
import { INBOX_ID, nextOccurrenceId } from '../domain/ids';
import { tagKey } from '../domain/tags';
import { nextDueDate } from '../domain/recurrence';
import { DEFAULT_REMINDER_TIME } from '../domain/reminders';
import { isValidTime } from '../domain/dates';
import { parseBackup, mergeBackup, buildBackup, hasChanges } from '../data/backup';
import { expiredIds } from '../data/purge';
import { mergeDuplicateTags } from '../domain/tagMerge';
import { syncQueue } from '../sync/queue';
import * as models from '../domain/models';
import { createInbox } from '../domain/models';
import { strings } from '../strings';

const u = strings.undo;

// Ayarlardaki tema seçimi: cihaz tercihini izle, hep açık, hep koyu.
export const THEME_MODES = ['system', 'light', 'dark'];

const REPOSITORIES = {
  tasks: taskRepository,
  categories: categoryRepository,
  tags: tagRepository,
  taskTags: taskTagRepository,
};

// Store tüm kayıtları (soft delete edilmişler dahil) tutar; ekranlar
// yalnızca canlı kayıtları göstermek için isAlive / liveRecords kullanır.
const { isAlive, liveRecords } = models;
export { isAlive, liveRecords };

function mergeById(list, records) {
  const byId = new Map(list.map(r => [r.id, r]));
  for (const record of records) byId.set(record.id, record);
  return [...byId.values()];
}

function applyChanges(state, changes) {
  const next = { ...state };
  for (const [collection, records] of Object.entries(changes)) {
    next[collection] = mergeById(state[collection], records);
  }
  return next;
}

// İki değişiklik kümesini birleştirir; aynı kayıt ikisinde de varsa sonraki kazanır.
function combineChanges(a, b) {
  const result = { ...a };
  for (const [collection, records] of Object.entries(b)) {
    if (records.length) result[collection] = mergeById(result[collection] ?? [], records);
  }
  return result;
}

// Açılışta süresi dolmuş silinmiş kayıtları kalıcı siler (X10). Kuyrukta
// bekleyenler sunucuya ulaşana kadar kalır.
async function purgeExpired(loaded, now = new Date()) {
  const result = { ...loaded };
  await Promise.all(
    Object.entries(REPOSITORIES).map(async ([collection, repository]) => {
      const ids = expiredIds(loaded[collection], now, id => syncQueue.has(collection, id));
      if (ids.length === 0) return;
      const removed = new Set(ids);
      result[collection] = loaded[collection].filter(r => !removed.has(r.id));
      await repository.removeMany(ids);
    }),
  );
  return result;
}

export const initialState = {
  status: 'idle', // idle | loading | ready | error
  error: null,
  tasks: [],
  categories: [],
  tags: [],
  taskTags: [],
  settings: { defaultReminderTime: DEFAULT_REMINDER_TIME, theme: 'system' },
  // Son geri alınabilir işlem: { id, label, snapshot: { [collection]: [{ id, prev }] } }
  // prev null ise kayıt o işlemde oluşturulmuştur (geri almada silinir).
  lastUndo: null,
};

let undoSeq = 0;

export const useTodoStore = create((set, get) => {
  // Değişiklikleri önce belleğe (arayüz hemen güncellenir), sonra depoya yazar.
  // undoLabel verilirse değişen kayıtların önceki hâli geri alma için saklanır;
  // verilmezse ve değişiklik saklanan kayıtlardan birine dokunuyorsa geri alma
  // iptal edilir (sonraki bir düzenlemenin üzerine yazılmasın).
  // enqueue: false yalnızca sunucudan gelen değişiklikler içindir (geri gönderilmez).
  async function commit(changes, undoLabel = null, { enqueue = true } = {}) {
    set(state => {
      const next = {};
      let lastUndo = state.lastUndo;
      if (undoLabel) {
        const snapshot = {};
        for (const [collection, records] of Object.entries(changes)) {
          snapshot[collection] = records.map(r => ({
            id: r.id,
            prev: state[collection].find(x => x.id === r.id) ?? null,
          }));
        }
        lastUndo = { id: ++undoSeq, label: undoLabel, snapshot };
      } else if (lastUndo && touchesSnapshot(lastUndo.snapshot, changes)) {
        lastUndo = null;
      }
      for (const [collection, records] of Object.entries(changes)) {
        next[collection] = mergeById(state[collection], records);
      }
      return { ...next, lastUndo };
    });
    try {
      // Önce kuyruk: depoya yazılıp kuyruğa girmeyen bir değişiklik hiç gönderilmezdi;
      // tersi (kuyrukta olup depoda eski kalan) yalnızca eski hâlin gönderilmesidir.
      if (enqueue) await syncQueue.enqueue(changes);
      await Promise.all(
        Object.entries(changes).map(([collection, records]) =>
          REPOSITORIES[collection].upsertMany(records),
        ),
      );
    } catch (e) {
      console.warn('Kaydetme hatası', e);
      set({ error: e.message });
      throw e;
    }
  }

  function touchesSnapshot(snapshot, changes) {
    return Object.entries(changes).some(([collection, records]) =>
      records.some(r => snapshot[collection]?.some(entry => entry.id === r.id)),
    );
  }

  function findAlive(collection, id) {
    const record = get()[collection].find(r => r.id === id && isAlive(r));
    if (!record) throw new Error(strings.errors.notFound(collection, id));
    return record;
  }

  function linksToAdd(taskId, tagIds) {
    return [...new Set(tagIds)].map(tagId => {
      findAlive('tags', tagId);
      return models.createTaskTag(taskId, tagId);
    });
  }

  // Görevin etiketlerini tagIds'e eşitlemek için gereken bağ değişiklikleri.
  function tagLinkChanges(taskId, tagIds) {
    const wanted = new Set(tagIds);
    const current = get().taskTags.filter(l => l.taskId === taskId && isAlive(l));
    const currentTagIds = new Set(current.map(l => l.tagId));
    const removed = current.filter(l => !wanted.has(l.tagId)).map(l => models.softDelete(l));
    const added = linksToAdd(taskId, tagIds.filter(id => !currentTagIds.has(id)));
    return [...removed, ...added];
  }

  function assertUniqueTagName(nameKey, exceptId) {
    const clash = liveRecords(get().tags).find(t => t.id !== exceptId && t.nameKey === nameKey);
    if (clash) throw new Error(strings.errors.duplicateTag);
  }

  return {
    ...initialState,

    async init() {
      if (get().status === 'loading' || get().status === 'ready') return;
      set({ status: 'loading', error: null });
      try {
        await runMigrations();
        const [tasks, categories, tags, taskTags, settings] = await Promise.all([
          taskRepository.list(),
          categoryRepository.list(),
          tagRepository.list(),
          taskTagRepository.list(),
          settingsRepository.get(initialState.settings),
          syncQueue.load(),
        ]);
        const records = await purgeExpired({ tasks, categories, tags, taskTags });
        set({ status: 'ready', ...records, settings });
      } catch (e) {
        console.warn('Veriler yüklenemedi', e);
        set({ status: 'error', error: e.message });
      }
    },

    // --- Görevler ---

    async addTask(input) {
      const { tagIds = [], ...fields } = input;
      findAlive('categories', fields.categoryId ?? INBOX_ID);
      const task = models.createTask(fields);
      await commit({ tasks: [task], taskTags: linksToAdd(task.id, tagIds) });
      return task;
    },

    // changes.tagIds verilirse görevin etiketleri de aynı işlemde güncellenir.
    async updateTask(id, changes) {
      const { tagIds, ...fields } = changes;
      if ('categoryId' in fields) findAlive('categories', fields.categoryId);
      const task = models.updateTask(findAlive('tasks', id), fields);
      const taskTags = tagIds ? tagLinkChanges(id, tagIds) : [];
      await commit({ tasks: [task], taskTags });
      return task;
    },

    // Tekrarlayan görev tamamlanınca sonraki tekrar oluşturulur (etiketleriyle).
    // İşaret kaldırılınca, henüz tamamlanmadıysa o sonraki görev silinir.
    // Sonraki görevin kimliği bu görevden türetilir (X13): silinmiş bir önceki
    // kopyası varsa yeniden canlanır; canlı bir kopyası varsa (ör. tamamlanmış
    // olduğu için geri almada silinmemişse) yeni görev oluşmaz, ona bağlanılır.
    async toggleTask(id) {
      const current = findAlive('tasks', id);
      const now = new Date();
      const task = models.toggleTask(current, now);
      const tasks = [task];
      const taskTags = [];

      if (task.completedAt && current.recurrence) {
        const existing = get().tasks.find(t => t.id === nextOccurrenceId(id));
        if (existing && isAlive(existing)) {
          task.nextTaskId = existing.id;
        } else {
          const next = models.createNextOccurrence(current, nextDueDate(current, now, now), now);
          const tagIds = liveRecords(get().taskTags).filter(l => l.taskId === id).map(l => l.tagId);
          task.nextTaskId = next.id;
          tasks.push(next);
          taskTags.push(...linksToAdd(next.id, tagIds));
        }
      } else if (!task.completedAt && current.nextTaskId) {
        task.nextTaskId = null;
        const next = get().tasks.find(t => t.id === current.nextTaskId);
        if (next && isAlive(next) && !next.completedAt) {
          tasks.push(models.softDelete(next, now));
          taskTags.push(
            ...liveRecords(get().taskTags).filter(l => l.taskId === next.id).map(l => models.softDelete(l, now)),
          );
        }
      }

      await commit({ tasks, taskTags }, task.completedAt ? u.taskCompleted : u.taskReopened);
      return task;
    },

    async deleteTasks(ids) {
      if (ids.length === 0) return;
      const tasks = ids.map(id => models.softDelete(findAlive('tasks', id)));
      await commit({ tasks }, u.tasksDeleted(ids.length));
    },

    // Son işlemi geri alır: kayıtlar önceki hâline döner, o işlemde oluşanlar silinir.
    async undo() {
      const { lastUndo } = get();
      if (!lastUndo) return;
      const now = new Date();
      const changes = {};
      for (const [collection, entries] of Object.entries(lastUndo.snapshot)) {
        changes[collection] = entries
          .map(({ id, prev }) => {
            if (prev) return { ...prev, updatedAt: now.toISOString() };
            const current = get()[collection].find(r => r.id === id);
            return current ? models.softDelete(current, now) : null;
          })
          .filter(Boolean);
      }
      set({ lastUndo: null });
      await commit(changes);
    },

    dismissUndo(id) {
      if (get().lastUndo?.id === id) set({ lastUndo: null });
    },

    async setTaskTags(taskId, tagIds) {
      findAlive('tasks', taskId);
      await commit({ taskTags: tagLinkChanges(taskId, tagIds) });
    },

    // --- Yedekleme ---

    exportBackup() {
      return buildBackup(get());
    },

    // Yedek metnini doğrular ve birleştirme özetini döndürür (henüz bir şey yazmaz).
    previewImport(text) {
      const backup = parseBackup(text);
      const { changes, summary } = mergeBackup(get(), backup);
      return { changes, summary, hasChanges: hasChanges(changes) };
    },

    // Önizlemesi alınmış değişiklikleri uygular; geri alınabilir. Ayarlar
    // cihaza özel tercih sayıldığı için içe aktarılmaz. Yedek aynı adda birden
    // fazla etiket getirirse (ör. senkron kopyası) aynı işlemde birleştirilir.
    async importBackup(preview) {
      if (!preview.hasChanges) return;
      const dedup = mergeDuplicateTags(applyChanges(get(), preview.changes));
      await commit(combineChanges(preview.changes, dedup), u.imported);
    },

    // --- Ayarlar ---

    async updateSettings(changes) {
      if ('defaultReminderTime' in changes && !isValidTime(changes.defaultReminderTime)) {
        throw new Error(strings.errors.invalidTime);
      }
      if ('theme' in changes && !THEME_MODES.includes(changes.theme)) {
        throw new Error(strings.errors.invalidTheme);
      }
      const settings = { ...get().settings, ...changes };
      set({ settings });
      await settingsRepository.save(settings);
      return settings;
    },

    // --- Senkron (v4) ---

    // Sunucudan gelen kayıtları yazar: yalnızca yerelde olmayan ya da yereldekinden
    // daha yeni (updatedAt) olanları (X6). Kuyruğa girmez, geri alma şeridi
    // oluşturmaz; geri alma kaydının dokunduğu bir kayda gelirse geri almayı iptal eder.
    async applyRemote(changes) {
      const accepted = {};
      for (const [collection, records] of Object.entries(changes)) {
        const local = new Map(get()[collection].map(r => [r.id, r]));
        accepted[collection] = records.filter(r => !local.has(r.id) || r.updatedAt > local.get(r.id).updatedAt);
      }
      if (hasChanges(accepted)) await commit(accepted, null, { enqueue: false });
      return accepted;
    },

    // Kayıtları kalıcı siler (tam eşitlemede sunucuda temizlenmiş olanlar, X10).
    async removeRecords(idsByCollection) {
      const entries = Object.entries(idsByCollection).filter(([, ids]) => ids.length);
      if (entries.length === 0) return;
      set(state => {
        const next = {};
        for (const [collection, ids] of entries) {
          const removed = new Set(ids);
          next[collection] = state[collection].filter(r => !removed.has(r.id));
        }
        const touched = Object.fromEntries(entries.map(([c, ids]) => [c, ids.map(id => ({ id }))]));
        const lastUndo = state.lastUndo && touchesSnapshot(state.lastUndo.snapshot, touched) ? null : state.lastUndo;
        return { ...next, lastUndo };
      });
      await Promise.all(entries.map(([collection, ids]) => REPOSITORIES[collection].removeMany(ids)));
    },

    // Çıkışta (X3): tüm kayıtlar silinir, yalnızca Gelen Kutusu kalır. Ayarlar kalır.
    async resetLocalData() {
      const empty = { tasks: [], categories: [createInbox()], tags: [], taskTags: [] };
      set({ ...empty, lastUndo: null });
      await Promise.all(
        Object.entries(REPOSITORIES).map(([collection, repository]) => repository.replaceAll(empty[collection])),
      );
    },

    // --- Kategoriler ---

    async addCategory(input) {
      const orders = liveRecords(get().categories).map(c => c.sortOrder);
      const category = models.createCategory(input, Math.max(0, ...orders) + 1);
      await commit({ categories: [category] });
      return category;
    },

    async updateCategory(id, changes) {
      const category = models.updateCategory(findAlive('categories', id), changes);
      await commit({ categories: [category] });
      return category;
    },

    // Kategori silinince görevleri silinmez, Gelen Kutusu'na taşınır.
    async deleteCategory(id) {
      const category = findAlive('categories', id);
      if (category.isSystem) throw new Error(strings.errors.inboxUndeletable);
      const tasks = liveRecords(get().tasks)
        .filter(t => t.categoryId === id)
        .map(t => models.updateTask(t, { categoryId: INBOX_ID }));
      await commit({ categories: [models.softDelete(category)], tasks }, u.categoryDeleted(category.name));
    },

    // --- Etiketler ---

    // Aynı adda (büyük/küçük harf fark etmeksizin) etiket varsa onu döndürür.
    async findOrCreateTag(name, color) {
      const key = tagKey(name);
      const existing = liveRecords(get().tags).find(t => t.nameKey === key);
      if (existing) return existing;
      const tag = models.createTag({ name, color });
      await commit({ tags: [tag] });
      return tag;
    },

    // Etiket formu için: aynı adda etiket varsa hata verir.
    async addTag(input) {
      const tag = models.createTag(input);
      assertUniqueTagName(tag.nameKey);
      await commit({ tags: [tag] });
      return tag;
    },

    async updateTag(id, changes) {
      const tag = models.updateTag(findAlive('tags', id), changes);
      assertUniqueTagName(tag.nameKey, id);
      await commit({ tags: [tag] });
      return tag;
    },

    // Aynı adlı canlı etiketleri birleştirir (X14). Senkron her çekmeden sonra
    // çağırır; geri alma şeridi göstermez.
    async mergeDuplicateTags() {
      const changes = mergeDuplicateTags(get());
      if (hasChanges(changes)) await commit(changes);
      return changes;
    },

    // Etiket silinince görevler kalır, yalnızca bağlar kaldırılır.
    async deleteTag(id) {
      const tag = findAlive('tags', id);
      const links = liveRecords(get().taskTags)
        .filter(l => l.tagId === id)
        .map(l => models.softDelete(l));
      await commit({ tags: [models.softDelete(tag)], taskTags: links }, u.tagDeleted(tag.name));
    },
  };
});
