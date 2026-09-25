import { liveRecords } from './models';
import { sortTasks } from './sorting';

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
