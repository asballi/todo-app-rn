const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { openDb, make } = require('./db');

const T1 = '2026-09-25T11:00:00.000Z';

let db;
before(async () => { db = await openDb(__filename); });
after(async () => { await db.close(); });

test('kayıtları server_seq sırasıyla ve koleksiyon adıyla döndürür', async () => {
  const user = await db.newUser();
  const tag = make.tag();
  const task = make.task();
  await db.push(user, { tags: [tag] });
  await db.push(user, { tasks: [task] });

  const page = await db.pull(user);
  assert.deepEqual(page.records.map(r => [r.collection, r.record.id]), [['tags', tag.id], ['tasks', task.id]]);
  assert.equal(page.has_more, false);
  assert.equal(page.next, page.records[1].record.server_seq);
  assert.equal(page.purged_seq, 0);
});

test('imleçten sonrakileri döndürür; güncellenen kayıt sona geçer', async () => {
  const user = await db.newUser();
  const a = make.task({ title: 'a' });
  const b = make.task({ title: 'b' });
  await db.push(user, { tasks: [a] });
  await db.push(user, { tasks: [b] });
  const { next } = await db.pull(user);

  assert.deepEqual((await db.pull(user, next)).records, []);
  assert.equal((await db.pull(user, next)).next, next, 'boş sayfada imleç yerinde kalır');

  await db.push(user, { tasks: [{ ...a, title: 'a2', updated_at: T1 }] });
  const page = await db.pull(user, next);
  assert.deepEqual(page.records.map(r => r.record.title), ['a2']);

  const all = await db.pull(user);
  assert.deepEqual(all.records.map(r => r.record.title), ['b', 'a2']);
});

test('sayfalama her kaydı bir kez döndürür', async () => {
  const user = await db.newUser();
  const tasks = Array.from({ length: 7 }, (_, i) => make.task({ title: `t${i}` }));
  const tags = Array.from({ length: 4 }, (_, i) => make.tag({ name: `g${i}`, name_key: `g${i}` }));
  await db.push(user, { tasks, tags });

  const seen = [];
  let since = 0;
  let pages = 0;
  for (;;) {
    const page = await db.pull(user, since, 3);
    pages++;
    seen.push(...page.records.map(r => r.record.id));
    since = page.next;
    if (!page.has_more) break;
  }
  assert.equal(pages, 4);
  assert.equal(seen.length, 11);
  assert.equal(new Set(seen).size, 11);
});

test('sayfa boyutu 1–1000 aralığına çekilir', async () => {
  const user = await db.newUser();
  await db.push(user, { tasks: [make.task(), make.task()] });
  assert.equal((await db.pull(user, 0, 0)).records.length, 1);
  assert.equal((await db.pull(user, 0, null)).records.length, 2);
});

test('eski şema sürümü push ve pull yapamaz', async () => {
  const user = await db.newUser();
  await assert.rejects(db.pull(user, 0, 500, 2), e => e.message === 'client_outdated' && e.detail === '3');
  await assert.rejects(db.push(user, { tasks: [make.task()] }, 2), /client_outdated/);
  await assert.rejects(db.pull(user, 0, 500, null), /client_outdated/);

  await db.admin.query('update public.sync_meta set min_schema_version = 4');
  try {
    await assert.rejects(db.pull(user), e => e.message === 'client_outdated' && e.detail === '4');
    assert.deepEqual((await db.pull(user, 0, 500, 4)).records, []);
  } finally {
    await db.admin.query('update public.sync_meta set min_schema_version = 3');
  }
});

test('oturum yoksa reddedilir', async () => {
  await assert.rejects(db.pull(null), /not_authenticated/);
});
