import { parseDateKey, formatDueLabel, isValidTime } from './dates';
import { strings } from '../strings';

// Hatırlatıcılar görevde "bitiş anından kaç dakika önce" olarak tutulur.
export const REMINDER_OPTIONS = [0, 10, 30, 60, 1440];
export const MAX_REMINDERS = 3;
export const DEFAULT_REMINDER_TIME = '09:00';

// Tarih yoksa hatırlatıcı olmaz; tekrarlar atılır, küçükten büyüğe sıralanır.
export function normalizeReminders(reminders, dueDate) {
  if (!dueDate) return [];
  if (!Array.isArray(reminders)) throw new Error(strings.errors.invalidReminder);
  const unique = [...new Set(reminders)];
  if (unique.some(r => !REMINDER_OPTIONS.includes(r))) throw new Error(strings.errors.invalidReminder);
  if (unique.length > MAX_REMINDERS) throw new Error(strings.errors.tooManyReminders(MAX_REMINDERS));
  return unique.sort((a, b) => a - b);
}

// Hatırlatıcıların referans anı: saatli görevde bitiş saati, saatsizde varsayılan saat.
export function reminderAnchor(task, defaultTime = DEFAULT_REMINDER_TIME) {
  const time = task.dueTime ?? (isValidTime(defaultTime) ? defaultTime : DEFAULT_REMINDER_TIME);
  return parseDateKey(task.dueDate, time);
}

// Şu anda kurulu olması gereken bildirimler. Tamamlanan, silinen, tarihsiz
// görevler ve zamanı geçmiş hatırlatıcılar dahil edilmez.
export function plannedNotifications(tasks, { defaultReminderTime } = {}, now = new Date()) {
  const planned = [];
  for (const task of tasks) {
    if (task.deletedAt || task.completedAt || !task.dueDate || !task.reminders?.length) continue;
    const anchor = reminderAnchor(task, defaultReminderTime);
    for (const offset of task.reminders) {
      const at = new Date(anchor.getTime() - offset * 60 * 1000);
      if (at <= now) continue;
      // Gövde, bildirimin çalacağı ana göre yazılır ("1 gün önce" → "Yarın 15:00").
      const body = formatDueLabel(task, at);
      planned.push({
        key: [task.id, offset, at.getTime(), task.title, body].join('|'),
        taskId: task.id,
        at,
        title: task.title,
        body,
      });
    }
  }
  return planned.sort((a, b) => a.at - b.at);
}
