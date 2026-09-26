const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { openDb, make } = require('./db');

const T1 = '2026-09-25T11:00:00.000Z';

let db;
before(async () => { db = await openDb(__filename); });
after(async () => { await db.close(); });

async function count(table, user) {
  const { rows } = await db.admin.query(`select count(*)::int as n from ${table} where ${table === 'auth.users' ? 'id' : 'user_id'} = $1`, [user]);
  return rows[0].n;
}

const TABLES = ['public.tasks', 'public.categories', 'public.tags', 'public.task_tags', 'public.sync_users', 'auth.users'];

test('hesabı ve tüm verisini siler, başkasınınkine dokunmaz', async () => {
  const alice = await db.newUser();
  const bob = await db.newUser();
  for (const user of [alice, bob]) {
    const task = make.task();
    const tag = make.tag();
    await db.push(user, {
      tasks: [task], categories: [make.category()], tags: [tag],
      task_tags: [make.taskTag({ task_id: task.id, tag_id: tag.id, deleted_at: T1, updated_at: T1 })],
    });
  }
  await db.admin.query('insert into public.sync_users (user_id, purged_seq) values ($1, 5), ($2, 5)', [alice, bob]);

  await db.asUser(alice, q => q('select public.delete_account()'));

  for (const table of TABLES) {
    assert.equal(await count(table, alice), 0, table);
    assert.equal(await count(table, bob), 1, table);
  }
});

test('oturum yoksa reddedilir', async () => {
  await assert.rejects(db.asUser(null, q => q('select public.delete_account()')), /not_authenticated/);
});
