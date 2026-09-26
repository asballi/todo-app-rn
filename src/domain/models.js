import { INBOX_ID, newId, nowIso, nextOccurrenceId, taskTagId } from './ids';
import { isValidDateKey, isValidTime } from './dates';
import { tagKey } from './tags';
import { normalizeRecurrence } from './recurrence';
import { normalizeReminders } from './reminders';
import { strings } from '../strings';

const { errors } = strings;

export const PRIORITIES = [0, 1, 2, 3];

export const isAlive = record => !record.deletedAt;
export const liveRecords = list => list.filter(isAlive);
export const DEFAULT_TAG_COLOR = null;

function baseRecord(now) {
  const ts = nowIso(now);
  return { id: newId(), createdAt: ts, updatedAt: ts, deletedAt: null };
}

function requireName(value, label) {
  const text = (value ?? '').trim();
  if (!text) throw new Error(errors.required(label));
  return text;
}

// Şema v3 ile eklenen alanlar (v2 hatırlatıcılar, tekrar, kontrol listesi).
const TASK_V3_DEFAULTS = { reminders: [], recurrence: null, nextTaskId: null, checklist: [] };

export function withTaskDefaults(task) {
  const result = { ...task };
  for (const [key, value] of Object.entries(TASK_V3_DEFAULTS)) {
    if (result[key] === undefined) result[key] = Array.isArray(value) ? [] : value;
  }
  return result;
}

export function createChecklistItem(title) {
  return { id: newId(), title: requireName(title, errors.fields.checklistItem), done: false };
}

// Boş maddeler atılır; eksik id ve done alanları tamamlanır.
function normalizeChecklist(checklist) {
  if (!Array.isArray(checklist)) throw new Error(errors.invalidChecklist);
  return checklist
    .map(item => ({ id: item.id ?? newId(), title: (item.title ?? '').trim(), done: !!item.done }))
    .filter(item => item.title);
}

function validateTaskFields(fields) {
  const task = { ...fields };
  task.title = requireName(task.title, errors.fields.taskTitle);
  task.notes = task.notes ?? '';
  task.dueDate = task.dueDate || null;
  task.dueTime = task.dueTime || null;
  if (task.dueDate && !isValidDateKey(task.dueDate)) throw new Error(errors.invalidDate);
  if (task.dueTime && !isValidTime(task.dueTime)) throw new Error(errors.invalidTime);
  // Saat yalnızca bir güne bağlı olarak anlamlıdır.
  if (!task.dueDate) task.dueTime = null;
  if (!PRIORITIES.includes(task.priority)) throw new Error(errors.invalidPriority);
  task.checklist = normalizeChecklist(task.checklist ?? []);
  // Tekrar bir bitiş tarihine bağlıdır; tarih kalkınca tekrar da kalkar.
  task.recurrence = normalizeRecurrence(task.recurrence ?? null, task.dueDate);
  task.reminders = normalizeReminders(task.reminders ?? [], task.dueDate);
  return task;
}

export function createTask(input, now = new Date()) {
  return validateTaskFields({
    ...baseRecord(now),
    title: input.title,
    notes: input.notes ?? '',
    categoryId: input.categoryId ?? INBOX_ID,
    dueDate: input.dueDate ?? null,
    dueTime: input.dueTime ?? null,
    priority: input.priority ?? 0,
    completedAt: null,
    reminders: input.reminders ?? [],
    recurrence: input.recurrence ?? null,
    nextTaskId: null,
    checklist: input.checklist ?? [],
  });
}

const EDITABLE_TASK_FIELDS = [
  'title', 'notes', 'categoryId', 'dueDate', 'dueTime', 'priority', 'checklist', 'recurrence', 'reminders',
];

export function updateTask(task, changes, now = new Date()) {
  const next = { ...task };
  for (const field of EDITABLE_TASK_FIELDS) {
    if (field in changes) next[field] = changes[field];
  }
  // Kullanıcı tarihi değiştirirse aylık/yıllık serinin günü yeni tarihten alınır.
  if (next.recurrence && next.dueDate !== task.dueDate) {
    next.recurrence = { ...next.recurrence, monthDay: null };
  }
  return { ...validateTaskFields(next), updatedAt: nowIso(now) };
}

// Tekrarlayan görev tamamlanınca oluşan sonraki görev: alanlar kopyalanır,
// kontrol listesi işaretsiz ve yeni kimliklerle gelir. Görevin kimliği öncekinden
// türetilir; iki cihazda tamamlanan aynı görev tek bir sonraki görev oluşturur.
export function createNextOccurrence(task, dueDate, now = new Date()) {
  const next = createTask(
    {
      title: task.title,
      notes: task.notes,
      categoryId: task.categoryId,
      dueDate,
      dueTime: task.dueTime,
      priority: task.priority,
      reminders: [...task.reminders],
      recurrence: task.recurrence,
      checklist: task.checklist.map(item => ({ title: item.title, done: false })),
    },
    now,
  );
  return { ...next, id: nextOccurrenceId(task.id) };
}

export function toggleTask(task, now = new Date()) {
  const ts = nowIso(now);
  return { ...task, completedAt: task.completedAt ? null : ts, updatedAt: ts };
}

export function softDelete(record, now = new Date()) {
  const ts = nowIso(now);
  return { ...record, deletedAt: ts, updatedAt: ts };
}

export function createInbox(now = new Date()) {
  return {
    ...baseRecord(now),
    id: INBOX_ID,
    name: strings.defaults.inboxName,
    color: '#6c63ff',
    icon: 'inbox',
    isSystem: true,
    sortOrder: 0,
  };
}

export function createCategory(input, sortOrder, now = new Date()) {
  return {
    ...baseRecord(now),
    name: requireName(input.name, errors.fields.categoryName),
    color: input.color ?? '#6c63ff',
    icon: input.icon ?? 'folder',
    isSystem: false,
    sortOrder,
  };
}

export function updateCategory(category, changes, now = new Date()) {
  const next = { ...category, updatedAt: nowIso(now) };
  if ('name' in changes) next.name = requireName(changes.name, errors.fields.categoryName);
  if ('color' in changes) next.color = changes.color;
  if ('icon' in changes) next.icon = changes.icon;
  if ('sortOrder' in changes) next.sortOrder = changes.sortOrder;
  return next;
}

export function createTag(input, now = new Date()) {
  const name = requireName(input.name, errors.fields.tagName);
  return { ...baseRecord(now), name, nameKey: tagKey(name), color: input.color ?? DEFAULT_TAG_COLOR };
}

export function updateTag(tag, changes, now = new Date()) {
  const next = { ...tag, updatedAt: nowIso(now) };
  if ('name' in changes) {
    next.name = requireName(changes.name, errors.fields.tagName);
    next.nameKey = tagKey(next.name);
  }
  if ('color' in changes) next.color = changes.color;
  return next;
}

// Bağın kimliği görev ve etiketten türetilir: iki cihaz aynı bağı ekleyince
// tek kayıt olur; kaldırılıp yeniden eklenen bağ aynı kaydı canlandırır.
export function createTaskTag(taskId, tagId, now = new Date()) {
  return { ...baseRecord(now), id: taskTagId(taskId, tagId), taskId, tagId };
}
