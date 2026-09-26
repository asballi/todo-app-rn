const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { openDb, make } = require('./db');

const T1 = '2026-09-25T11:00:00.000Z';
const T_OLD = '2026-09-25T09:00:00.000Z';

let db;
before(async () => { db = await openDb(__filename); });
after(async () => { await db.close(); });

async function rows(table, userId) {
  return (await db.admin.query(`select * from public.${table} where user_id = $1 order by id`, [userId])).rows;
}

test('dört koleksiyonu yazar ve yazılan kimlikleri döndürür', async () => {
  const user = await db.newUser();
  const task = make.task();
  const category = make.category();
  const tag = make.tag();
  const link = make.taskTag({ task_id: task.id, tag_id: tag.id });

  const result = await db.push(user, {
    tasks: [task], categories: [category], tags: [tag], task_tags: [link],
  });

  assert.deepEqual(result.written, {
    tasks: [task.id], categories: [category.id], tags: [tag.id], task_tags: [link.id],
  });
  assert.equal((await rows('tasks', user)).length, 1);
  assert.equal((await rows('task_tags', user))[0].tag_id, tag.id);
});

test('eksik koleksiyonlar boş sayılır', async () => {
  const user = await db.newUser();
  const result = await db.push(user, {});
  assert.deepEqual(result.written, { tasks: [], categories: [], tags: [], task_tags: [] });
});

test('alanlar pull ile aynı değerlerle geri gelir', async () => {
  const user = await db.newUser();
  const task = make.task({
    title: 'Kira öde', notes: 'banka', category_id: 'c1', due_date: '2026-10-01', due_time: '15:30',
    priority: 3, completed_at: '2026-09-25T12:34:56.789Z', reminders: [0, 60],
    recurrence: { unit: 'month', interval: 1, weekdays: null, from: 'due', monthDay: 1 },
    next_task_id: 'n1', checklist: [{ id: 'a', title: 'Dekont', done: true }],
  });
  await db.push(user, { tasks: [task] });

  const { records } = await db.pull(user);
  assert.equal(records.length, 1);
  assert.equal(records[0].collection, 'tasks');
  const r = records[0].record;
  assert.equal(r.user_id, undefined);
  for (const key of ['id', 'title', 'notes', 'category_id', 'due_date', 'due_time', 'priority',
    'next_task_id', 'deleted_at']) {
    assert.deepEqual(r[key], task[key], key);
  }
  assert.deepEqual(r.reminders, task.reminders);
  assert.deepEqual(r.recurrence, task.recurrence);
  assert.deepEqual(r.checklist, task.checklist);
  // Zaman damgaları Postgres biçiminde döner; istemci toISOString() ile çevirir.
  for (const key of ['created_at', 'updated_at', 'completed_at']) {
    assert.equal(new Date(r[key]).toISOString(), task[key], key);
  }
  assert.equal(typeof r.server_seq, 'number');
  assert.ok(r.server_updated_at);
});

test('yalnızca daha yeni updated_at mevcut kaydın üzerine yazar', async () => {
  const user = await db.newUser();
  const task = make.task({ title: 'İlk' });
  await db.push(user, { tasks: [task] });

  const older = await db.push(user, { tasks: [{ ...task, title: 'Eski', updated_at: T_OLD }] });
  assert.deepEqual(older.written.tasks, []);
  const same = await db.push(user, { tasks: [{ ...task, title: 'Aynı an' }] });
  assert.deepEqual(same.written.tasks, [], 'eşitlikte sunucudaki kalır');
  assert.equal((await rows('tasks', user))[0].title, 'İlk');

  const newer = await db.push(user, { tasks: [{ ...task, title: 'Yeni', updated_at: T1 }] });
  assert.deepEqual(newer.written.tasks, [task.id]);
  assert.equal((await rows('tasks', user))[0].title, 'Yeni');
});

test('soft delete bir güncellemedir ve kural aynıdır', async () => {
  const user = await db.newUser();
  const tag = make.tag();
  await db.push(user, { tags: [tag] });
  await db.push(user, { tags: [{ ...tag, deleted_at: T1, updated_at: T1 }] });
  const [row] = await rows('tags', user);
  assert.equal(row.deleted_at.toISOString(), T1);
});

test('aynı kayıt bir gönderimde iki kez gelirse en yenisi yazılır', async () => {
  const user = await db.newUser();
  const task = make.task({ title: 'A' });
  const result = await db.push(user, {
    tasks: [{ ...task, title: 'B', updated_at: T1 }, task],
  });
  assert.deepEqual(result.written.tasks, [task.id]);
  assert.equal((await rows('tasks', user))[0].title, 'B');
});

test('sunucu sütunları ve user_id istemciden alınmaz', async () => {
  const user = await db.newUser();
  const other = await db.newUser();
  const task = make.task({ user_id: other, server_seq: 999999999, server_updated_at: '2000-01-01T00:00:00Z' });
  await db.push(user, { tasks: [task] });

  assert.equal((await rows('tasks', other)).length, 0);
  const [row] = await rows('tasks', user);
  assert.ok(Number(row.server_seq) < 999999999);
  assert.ok(row.server_updated_at > new Date('2020-01-01'));
});

test('her yazma server_seq değerini ilerletir', async () => {
  const user = await db.newUser();
  const task = make.task();
  await db.push(user, { tasks: [task] });
  const first = Number((await rows('tasks', user))[0].server_seq);
  await db.push(user, { tasks: [{ ...task, updated_at: T1 }] });
  const second = Number((await rows('tasks', user))[0].server_seq);
  assert.ok(second > first);
});

test('kısıtlara uymayan gönderim tümüyle reddedilir', async () => {
  const user = await db.newUser();
  const good = make.task();
  const cases = [
    make.task({ priority: 4 }),
    make.task({ due_time: '15:00' }), // tarihsiz saat
    make.task({ due_date: '2026-09-25', due_time: '25:00' }),
    make.task({ reminders: null }),
    make.task({ checklist: {} }),
    make.task({ title: null }),
  ];
  for (const bad of cases) {
    await assert.rejects(db.push(user, { tasks: [good, bad] }), /violates/);
  }
  assert.equal((await rows('tasks', user)).length, 0, 'geçerli kayıt da yazılmaz');
});

test('oturum yoksa reddedilir', async () => {
  await assert.rejects(db.push(null, { tasks: [make.task()] }), /not_authenticated/);
});

test('zaman damgası milisaniyeleri korunur', async () => {
  const user = await db.newUser();
  const stamp = '2026-09-25T10:00:00.001Z';
  const task = make.task({ updated_at: stamp });
  await db.push(user, { tasks: [task] });
  // 1 ms daha yeni bir düzenleme yine kazanır.
  const result = await db.push(user, { tasks: [{ ...task, title: 'x', updated_at: '2026-09-25T10:00:00.002Z' }] });
  assert.deepEqual(result.written.tasks, [task.id]);
  const { records } = await db.pull(user);
  assert.equal(new Date(records[0].record.updated_at).toISOString(), '2026-09-25T10:00:00.002Z');
});
