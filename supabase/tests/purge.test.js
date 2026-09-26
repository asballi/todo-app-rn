const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { openDb, make } = require('./db');

const T1 = '2026-09-25T11:00:00.000Z';

let db;
before(async () => { db = await openDb(__filename); });
after(async () => { await db.close(); });

// Sunucu saatini geri almak yerine satırın server_updated_at'ını geçmişe çeker
// (tetikleyiciyi atlayarak).
async function age(table, id, days) {
  await db.admin.query('begin');
  await db.admin.query('set local session_replication_role = replica');
  await db.admin.query(
    `update public.${table} set server_updated_at = now() - make_interval(days => $2) where id = $1`,
    [id, days],
  );
  await db.admin.query('commit');
}

async function seqOf(table, id) {
  const { rows } = await db.admin.query(`select server_seq from public.${table} where id = $1`, [id]);
  return Number(rows[0].server_seq);
}

async function ids(table) {
  return (await db.admin.query(`select id from public.${table} order by id`)).rows.map(r => r.id);
}

async function purgedSeq(user) {
  const { rows } = await db.admin.query('select purged_seq from public.sync_users where user_id = $1', [user]);
  return rows[0] ? Number(rows[0].purged_seq) : 0;
}

test('30 günden eski silinmiş kayıtları kalıcı siler ve purged_seq ilerler', async () => {
  const alice = await db.newUser();
  const bob = await db.newUser();
  const oldDeleted = make.task({ deleted_at: T1, updated_at: T1 });
  const newDeleted = make.task({ deleted_at: T1, updated_at: T1 });
  const oldAlive = make.task();
  const oldTag = make.tag({ deleted_at: T1, updated_at: T1 });
  const oldLink = make.taskTag({ deleted_at: T1, updated_at: T1 });
  const oldCategory = make.category({ deleted_at: T1, updated_at: T1 });
  await db.push(alice, { tasks: [oldDeleted, newDeleted, oldAlive], tags: [oldTag], task_tags: [oldLink] });
  const bobDeleted = make.task({ deleted_at: T1, updated_at: T1 });
  await db.push(bob, { tasks: [bobDeleted], categories: [oldCategory] });

  for (const [table, rec] of [['tasks', oldDeleted], ['tasks', oldAlive], ['tags', oldTag],
    ['task_tags', oldLink], ['tasks', bobDeleted], ['categories', oldCategory]]) {
    await age(table, rec.id, 31);
  }
  await age('tasks', newDeleted.id, 29);

  const aliceMax = Math.max(await seqOf('tasks', oldDeleted.id), await seqOf('tags', oldTag.id),
    await seqOf('task_tags', oldLink.id));
  const bobMax = Math.max(await seqOf('tasks', bobDeleted.id), await seqOf('categories', oldCategory.id));

  const { rows } = await db.admin.query('select public.purge_deleted() as n');
  assert.equal(Number(rows[0].n), 5);

  assert.deepEqual(await ids('tasks'), [newDeleted.id, oldAlive.id].sort());
  assert.deepEqual(await ids('tags'), []);
  assert.deepEqual(await ids('task_tags'), []);
  assert.deepEqual(await ids('categories'), []);
  assert.equal(await purgedSeq(alice), aliceMax);
  assert.equal(await purgedSeq(bob), bobMax);
  assert.equal((await db.pull(alice)).purged_seq, aliceMax);
});

test('purged_seq geri gitmez; silinecek bir şey yoksa değişmez', async () => {
  const alice = await db.newUser();
  const first = make.task({ deleted_at: T1, updated_at: T1 });
  await db.push(alice, { tasks: [first] });
  await age('tasks', first.id, 40);
  await db.admin.query('select public.purge_deleted()');
  const after1 = await purgedSeq(alice);
  assert.ok(after1 > 0);

  const { rows } = await db.admin.query('select public.purge_deleted() as n');
  assert.equal(Number(rows[0].n), 0);
  assert.equal(await purgedSeq(alice), after1);

  // Temizlenen kaydı eski bir cihaz yeniden gönderirse yeni bir satır olur;
  // istemci bu yüzden tam eşitlemede kuyrukta olmayanları göndermez.
  await db.push(alice, { tasks: [first] });
  assert.ok(await seqOf('tasks', first.id) > after1);
});

test('saklama süresi parametreyle değiştirilebilir', async () => {
  const alice = await db.newUser();
  const t = make.task({ deleted_at: T1, updated_at: T1 });
  await db.push(alice, { tasks: [t] });
  await age('tasks', t.id, 2);
  await db.admin.query(`select public.purge_deleted(interval '3 days')`);
  assert.ok((await ids('tasks')).includes(t.id));
  await db.admin.query(`select public.purge_deleted(interval '1 day')`);
  assert.ok(!(await ids('tasks')).includes(t.id));
});
