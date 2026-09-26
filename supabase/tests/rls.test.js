const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { openDb, make } = require('./db');

const T1 = '2026-09-25T11:00:00.000Z';

let db;
before(async () => { db = await openDb(__filename); });
after(async () => { await db.close(); });

test('kullanıcı başkasının kayıtlarını çekemez', async () => {
  const alice = await db.newUser();
  const bob = await db.newUser();
  await db.push(alice, { tasks: [make.task()] });
  assert.deepEqual((await db.pull(bob)).records, []);
});

test('aynı kimlik ("inbox") her kullanıcıda ayrı kayıttır', async () => {
  const alice = await db.newUser();
  const bob = await db.newUser();
  const inbox = make.category({ id: 'inbox', name: 'Gelen Kutusu', is_system: true, sort_order: 0 });
  await db.push(alice, { categories: [inbox] });
  const result = await db.push(bob, { categories: [{ ...inbox, name: 'Bob', updated_at: T1 }] });
  assert.deepEqual(result.written.categories, ['inbox']);

  const names = async user => (await db.pull(user)).records.map(r => r.record.name);
  assert.deepEqual(await names(alice), ['Gelen Kutusu']);
  assert.deepEqual(await names(bob), ['Bob']);
});

test('tablolara doğrudan erişim de yalnızca kendi satırlarıyla sınırlı', async () => {
  const alice = await db.newUser();
  const bob = await db.newUser();
  await db.push(alice, { tasks: [make.task()] });
  await db.push(bob, { tasks: [make.task()] });

  const visible = await db.asUser(bob, q => q('select user_id from public.tasks'));
  assert.deepEqual(visible.map(r => r.user_id), [bob]);

  const updated = await db.asUser(bob, q => q(`update public.tasks set title = 'x' where user_id = $1 returning id`, [alice]));
  assert.deepEqual(updated, []);

  const t = make.task();
  await assert.rejects(
    db.asUser(bob, q => q(
      `insert into public.tasks (user_id, id, created_at, updated_at, title, notes, category_id, priority, reminders, checklist)
       values ($1, $2, now(), now(), 'x', '', 'inbox', 0, '[]', '[]')`, [alice, t.id])),
    /row-level security/,
  );
  await assert.rejects(db.asUser(bob, q => q('delete from public.tasks')), /permission denied/);
});

test('doğrudan yazma da sunucu sütunlarını doldurur', async () => {
  const alice = await db.newUser();
  const t = make.task();
  await db.push(alice, { tasks: [t] });
  const { next } = await db.pull(alice);
  await db.asUser(alice, q => q(`update public.tasks set title = 'y' where id = $1`, [t.id]));
  const page = await db.pull(alice, next);
  assert.deepEqual(page.records.map(r => r.record.title), ['y']);
});

test('anon hiçbir şeye erişemez', async () => {
  const anon = (fn) => db.asUser(null, fn, db.admin, 'anon');
  await assert.rejects(anon(q => q('select * from public.tasks')), /permission denied/);
  await assert.rejects(anon(q => q('select * from public.sync_meta')), /permission denied/);
  await assert.rejects(anon(q => q(`select public.pull(3, 0, 10)`)), /permission denied/);
  await assert.rejects(anon(q => q(`select public.push(3, '{}')`)), /permission denied/);
  await assert.rejects(anon(q => q('select public.delete_account()')), /permission denied/);
});

test('temizlik fonksiyonu istemciye kapalı', async () => {
  const alice = await db.newUser();
  await assert.rejects(db.asUser(alice, q => q('select public.purge_deleted()')), /permission denied/);
});

test('sync_meta okunabilir, değiştirilemez', async () => {
  const alice = await db.newUser();
  const rows = await db.asUser(alice, q => q('select min_schema_version from public.sync_meta'));
  assert.deepEqual(rows, [{ min_schema_version: 3 }]);
  await assert.rejects(db.asUser(alice, q => q('update public.sync_meta set min_schema_version = 1')), /permission denied/);
});

test('tablolar Realtime yayınında', async () => {
  const { rows } = await db.admin.query(
    `select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename`,
  );
  assert.deepEqual(rows.map(r => r.tablename), ['categories', 'tags', 'task_tags', 'tasks']);
});

test('sıra numarası istemciden ilerletilemez', async () => {
  const alice = await db.newUser();
  await assert.rejects(db.asUser(alice, q => q(`select nextval('public.sync_seq')`)), /permission denied/);
});
