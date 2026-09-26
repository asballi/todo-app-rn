// İstemci kayıtları ↔ sunucu satırları (supabase/migrations/…_sync_schema.sql).
// İstemci alanları camelCase, sütunlar snake_case; koleksiyon adı da farklı
// olabilir (taskTags ↔ task_tags). Yalnızca burada listelenen alanlar senkronize olur.

const COMMON = ['id', 'createdAt', 'updatedAt', 'deletedAt'];

export const SYNC_FIELDS = {
  tasks: [...COMMON, 'title', 'notes', 'categoryId', 'dueDate', 'dueTime', 'priority', 'completedAt',
    'reminders', 'recurrence', 'nextTaskId', 'checklist'],
  categories: [...COMMON, 'name', 'color', 'icon', 'isSystem', 'sortOrder'],
  tags: [...COMMON, 'name', 'nameKey', 'color'],
  taskTags: [...COMMON, 'taskId', 'tagId'],
};

export const COLLECTIONS = Object.keys(SYNC_FIELDS);

const SERVER_NAMES = { tasks: 'tasks', categories: 'categories', tags: 'tags', taskTags: 'task_tags' };
const CLIENT_NAMES = Object.fromEntries(Object.entries(SERVER_NAMES).map(([c, s]) => [s, c]));

export const toServerCollection = collection => SERVER_NAMES[collection];
export const toClientCollection = name => CLIENT_NAMES[name];

const TIMESTAMPS = new Set(['createdAt', 'updatedAt', 'deletedAt', 'completedAt']);
const snake = field => field.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);

export function toServerRecord(collection, record) {
  const row = {};
  for (const field of SYNC_FIELDS[collection]) row[snake(field)] = record[field] ?? null;
  return row;
}

// Zaman damgaları sunucudan Postgres biçiminde (…+00:00, mikro saniyeli) gelebilir;
// istemci biçimine (toISOString) çevrilir, karşılaştırmalar bu biçimde yapılır.
export function toClientRecord(collection, row) {
  const record = {};
  for (const field of SYNC_FIELDS[collection]) {
    const value = row[snake(field)] ?? null;
    record[field] = TIMESTAMPS.has(field) && value !== null ? new Date(value).toISOString() : value;
  }
  return record;
}

// { tasks: [...], taskTags: [...] } → { tasks: [...], task_tags: [...] }
export function toServerChanges(changes) {
  const result = {};
  for (const [collection, records] of Object.entries(changes)) {
    if (records.length) result[toServerCollection(collection)] = records.map(r => toServerRecord(collection, r));
  }
  return result;
}
