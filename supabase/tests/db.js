// SQL testleri için yardımcılar. Her test dosyası şablondan kendi veritabanını alır.
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { Client } = require('pg');

const conn = JSON.parse(process.env.TEST_PG ?? 'null');
const template = process.env.TEST_PG_TEMPLATE;
if (!conn) throw new Error('Bu testler `npm run test:db` ile çalıştırılır.');

const SCHEMA = 3;

async function openDb(testFile) {
  const name = `todo_test_${path.basename(testFile, '.test.js').replace(/\W/g, '_')}_${process.pid}`;
  const server = new Client({ ...conn, database: conn.database ?? 'postgres' });
  await server.connect();
  await server.query(`drop database if exists ${name}`);
  await server.query(`create database ${name} template ${template}`);

  const clients = [];
  async function connect() {
    const client = new Client({ ...conn, database: name });
    await client.connect();
    clients.push(client);
    return client;
  }
  const admin = await connect();

  // fn, kullanıcı olarak (authenticated rolü + JWT'deki sub) tek bir işlem içinde çalışır.
  async function asUser(userId, fn, client = admin, role = 'authenticated') {
    await client.query('begin');
    try {
      await client.query(`set local role ${role}`);
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(userId ? { sub: userId, role } : { role }),
      ]);
      const result = await fn(async (sql, params) => (await client.query(sql, params)).rows);
      await client.query('commit');
      return result;
    } catch (e) {
      await client.query('rollback');
      throw e;
    }
  }

  return {
    admin,
    connect,
    asUser,
    async newUser() {
      const id = randomUUID();
      await admin.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@test`]);
      return id;
    },
    push(userId, changes, schema = SCHEMA) {
      return asUser(userId, async q => (await q('select public.push($1, $2) as r', [schema, changes]))[0].r);
    },
    pull(userId, since = 0, lim = 500, schema = SCHEMA) {
      return asUser(userId, async q => (await q('select public.pull($1, $2, $3) as r', [schema, since, lim]))[0].r);
    },
    async close() {
      for (const client of clients) await client.end().catch(() => {});
      await server.query(`drop database if exists ${name} with (force)`);
      await server.end();
    },
  };
}

// İstemcinin göndereceği biçimde (snake_case) örnek kayıtlar.
const T0 = '2026-09-25T10:00:00.000Z';

function base(overrides) {
  return { id: randomUUID(), created_at: T0, updated_at: T0, deleted_at: null, ...overrides };
}

const make = {
  task: o => base({
    title: 'Süt al', notes: '', category_id: 'inbox', due_date: null, due_time: null,
    priority: 0, completed_at: null, reminders: [], recurrence: null, next_task_id: null,
    checklist: [], ...o,
  }),
  category: o => base({ name: 'İş', color: '#6c63ff', icon: 'folder', is_system: false, sort_order: 1, ...o }),
  tag: o => base({ name: 'Ev', name_key: 'ev', color: null, ...o }),
  taskTag: o => base({ task_id: randomUUID(), tag_id: randomUUID(), ...o }),
};

module.exports = { openDb, make, T0, SCHEMA };
