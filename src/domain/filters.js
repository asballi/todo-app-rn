import { liveRecords } from './models';
import { sortTasks } from './sorting';
import { tagKey } from './tags';
import { foldForSearch } from './text';
import { strings } from '../strings';
import { toDateKey, addDays, isOverdue, isCompletedOn } from './dates';

export function sortCategories(categories) {
  return liveRecords(categories).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, strings.locale),
  );
}

export function tasksInCategory(tasks, categoryId) {
  return sortTasks(liveRecords(tasks).filter(t => t.categoryId === categoryId));
}

// { [categoryId]: tamamlanmamış görev sayısı }
export function openTaskCountsByCategory(tasks) {
  const counts = {};
  for (const task of liveRecords(tasks)) {
    if (!task.completedAt) counts[task.categoryId] = (counts[task.categoryId] ?? 0) + 1;
  }
  return counts;
}

export function sortTags(tags) {
  return liveRecords(tags).sort((a, b) => a.name.localeCompare(b.name, strings.locale));
}

// { [taskId]: [tag, ...] } — ada göre sıralı, yalnızca canlı bağ ve etiketler.
export function tagsByTask(tags, taskTags) {
  const byId = new Map(sortTags(tags).map((t, i) => [t.id, { tag: t, order: i }]));
  const result = {};
  for (const link of liveRecords(taskTags)) {
    const entry = byId.get(link.tagId);
    if (entry) (result[link.taskId] ??= []).push(entry);
  }
  for (const taskId of Object.keys(result)) {
    result[taskId] = result[taskId].sort((a, b) => a.order - b.order).map(e => e.tag);
  }
  return result;
}

export function tasksWithTag(tasks, taskTags, tagId) {
  const taskIds = new Set(liveRecords(taskTags).filter(l => l.tagId === tagId).map(l => l.taskId));
  return sortTasks(liveRecords(tasks).filter(t => taskIds.has(t.id)));
}

// { [tagId]: tamamlanmamış görev sayısı }
export function openTaskCountsByTag(tasks, taskTags) {
  const open = new Set(liveRecords(tasks).filter(t => !t.completedAt).map(t => t.id));
  const counts = {};
  for (const link of liveRecords(taskTags)) {
    if (open.has(link.taskId)) counts[link.tagId] = (counts[link.tagId] ?? 0) + 1;
  }
  return counts;
}

// Etiket seçici önerileri: adında sorgu geçen, henüz seçilmemiş etiketler.
export function suggestTags(tags, query, excludeIds = []) {
  const key = tagKey(query);
  const exclude = new Set(excludeIds);
  return sortTags(tags).filter(t => !exclude.has(t.id) && t.nameKey.includes(key));
}

// --- Akıllı listeler ---

// Bugün: gecikmişler ayrı bölümde; tamamlananlarda yalnızca bugün tamamlanan
// ve bitişi bugün ya da daha önce olan görevler (yani Bugün listesine ait olanlar).
export function todayView(tasks, now = new Date()) {
  const today = toDateKey(now);
  const overdue = [];
  const due = [];
  const completed = [];
  for (const task of liveRecords(tasks)) {
    if (task.completedAt) {
      if (task.dueDate && task.dueDate <= today && isCompletedOn(task, today)) completed.push(task);
    } else if (isOverdue(task, now)) {
      overdue.push(task);
    } else if (task.dueDate === today) {
      due.push(task);
    }
  }
  return { overdue: sortTasks(overdue), today: sortTasks(due), completed: sortTasks(completed) };
}

// Yaklaşan: yarından başlayarak `days` gün; her gün boş olsa da listelenir.
export function upcomingView(tasks, now = new Date(), days = 7) {
  const today = toDateKey(now);
  const groups = Array.from({ length: days }, (_, i) => ({ date: addDays(today, i + 1), tasks: [] }));
  const byDate = new Map(groups.map(g => [g.date, g]));
  const completed = [];
  for (const task of liveRecords(tasks)) {
    const group = byDate.get(task.dueDate);
    if (!group) continue;
    if (task.completedAt) completed.push(task);
    else group.tasks.push(task);
  }
  for (const group of groups) group.tasks = sortTasks(group.tasks);
  return { days: groups, completed: sortTasks(completed) };
}

// Önemli: yüksek öncelikli, tamamlanmamış görevler.
export const IMPORTANT_PRIORITY = 3;

export function importantTasks(tasks) {
  return sortTasks(liveRecords(tasks).filter(t => !t.completedAt && t.priority === IMPORTANT_PRIORITY));
}

export function overdueTasks(tasks, now = new Date()) {
  return sortTasks(liveRecords(tasks).filter(t => isOverdue(t, now)));
}

// Sıralı bir görev listesini açık ve tamamlanmış olarak ayırır (sıra korunur).
export function splitCompleted(tasks) {
  return {
    open: tasks.filter(t => !t.completedAt),
    completed: tasks.filter(t => t.completedAt),
  };
}

// --- Arama ---

export function hasSearchCriteria({ query = '', categoryId = null, tagIds = [], priorities = [] }) {
  return query.trim().length > 0 || categoryId != null || tagIds.length > 0 || priorities.length > 0;
}

// Başlık, not ve kontrol listesi maddelerinde arama + filtreler.
// Sorgudaki her kelime geçmelidir.
// categoryId: tek kategori (null = hepsi); tagIds: tagMode 'all' ise hepsi (VE),
// 'any' ise herhangi biri (VEYA); priorities: herhangi biri (VEYA, boş = hepsi).
export function searchTasks(
  tasks,
  taskTags,
  { query = '', categoryId = null, tagIds = [], tagMode = 'all', priorities = [] },
) {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  let tagsOf = null;
  if (tagIds.length > 0) {
    tagsOf = new Map();
    for (const link of liveRecords(taskTags)) {
      if (!tagsOf.has(link.taskId)) tagsOf.set(link.taskId, new Set());
      tagsOf.get(link.taskId).add(link.tagId);
    }
  }

  return sortTasks(
    liveRecords(tasks).filter(task => {
      if (categoryId != null && task.categoryId !== categoryId) return false;
      if (priorities.length > 0 && !priorities.includes(task.priority)) return false;
      if (tagsOf) {
        const own = tagsOf.get(task.id);
        const matches = tagMode === 'any' ? tagIds.some(id => own?.has(id)) : tagIds.every(id => own?.has(id));
        if (!own || !matches) return false;
      }
      if (words.length > 0) {
        const items = (task.checklist ?? []).map(i => i.title).join(' ');
        const haystack = foldForSearch(`${task.title} ${task.notes ?? ''} ${items}`);
        if (!words.every(w => haystack.includes(w))) return false;
      }
      return true;
    }),
  );
}
