import { create } from 'zustand';
import { runMigrations } from '../data/migrations';
import {
  taskRepository,
  categoryRepository,
  tagRepository,
  taskTagRepository,
  settingsRepository,
} from '../data/repositories';
import { INBOX_ID } from '../domain/ids';
import { tagKey } from '../domain/tags';
import { nextDueDate } from '../domain/recurrence';
import { DEFAULT_REMINDER_TIME } from '../domain/reminders';
import { isValidTime } from '../domain/dates';
import * as models from '../domain/models';
import { strings } from '../strings';

const u = strings.undo;

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

export const initialState = {
  status: 'idle', // idle | loading | ready | error
  error: null,
  tasks: [],
  categories: [],
  tags: [],
  taskTags: [],
  settings: { defaultReminderTime: DEFAULT_REMINDER_TIME },
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
  async function commit(changes, undoLabel = null) {
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
        ]);
        set({ status: 'ready', tasks, categories, tags, taskTags, settings });
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
    async toggleTask(id) {
      const current = findAlive('tasks', id);
      const now = new Date();
      const task = models.toggleTask(current, now);
      const tasks = [task];
      const taskTags = [];

      if (task.completedAt && current.recurrence) {
        const next = models.createNextOccurrence(current, nextDueDate(current, now, now), now);
        const tagIds = liveRecords(get().taskTags).filter(l => l.taskId === id).map(l => l.tagId);
        task.nextTaskId = next.id;
        tasks.push(next);
        taskTags.push(...linksToAdd(next.id, tagIds));
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

    // --- Ayarlar ---

    async updateSettings(changes) {
      if ('defaultReminderTime' in changes && !isValidTime(changes.defaultReminderTime)) {
        throw new Error(strings.errors.invalidTime);
      }
      const settings = { ...get().settings, ...changes };
      set({ settings });
      await settingsRepository.save(settings);
      return settings;
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
