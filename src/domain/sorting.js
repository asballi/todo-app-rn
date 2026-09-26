import { dueAt } from './dates';

// Varsayılan sıralama: tamamlanmamışlar önce, sonra bitiş zamanı (tarihsizler
// sona), sonra öncelik (yüksekten düşüğe), sonra oluşturulma zamanı.
// Aynı gün içinde saatli görevler saatsizlerden önce gelir.
export function compareTasks(a, b) {
  const doneA = a.completedAt ? 1 : 0;
  const doneB = b.completedAt ? 1 : 0;
  if (doneA !== doneB) return doneA - doneB;

  const dueA = dueAt(a)?.getTime() ?? Infinity;
  const dueB = dueAt(b)?.getTime() ?? Infinity;
  if (dueA !== dueB) return dueA < dueB ? -1 : 1;

  if (a.priority !== b.priority) return b.priority - a.priority;

  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortTasks(tasks) {
  return [...tasks].sort(compareTasks);
}
