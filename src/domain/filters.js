import { liveRecords } from './models';
import { sortTasks } from './sorting';
import { tagKey } from './tags';

export function sortCategories(categories) {
  return liveRecords(categories).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'),
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
  return liveRecords(tags).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
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
