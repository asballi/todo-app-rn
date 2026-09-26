// Bellek içinde çalışan sahte senkron sunucusu: supabase/migrations/ içindeki
// push / pull / purge_deleted / delete_account fonksiyonlarının davranışını taklit
// eder. Motor testleri (Jest) ve e2e test sunucusu kullanır.
//
// Satırlar sunucu biçimindedir (snake_case) ve zaman damgaları Postgres'in
// döndürdüğü biçimde (+00:00) döner; böylece istemcinin çevirisi de sınanır.
import { RemoteError } from './errors';

const SERVER_COLLECTIONS = ['tasks', 'categories', 'tags', 'task_tags'];
const SERVER_ONLY = ['server_seq', 'server_updated_at'];
const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const pgTime = iso => (iso ? new Date(iso).toISOString().replace('Z', '+00:00') : iso);
const TIMESTAMP_COLUMNS = ['created_at', 'updated_at', 'deleted_at', 'completed_at'];

function validate(collection, row) {
  const fail = message => { throw new RemoteError('rejected', message, collection); };
  for (const column of ['id', 'created_at', 'updated_at']) if (row[column] == null) fail(`${column} null`);
  if (collection === 'tasks') {
    if (row.title == null || row.notes == null || row.category_id == null) fail('task text null');
    if (![0, 1, 2, 3].includes(row.priority)) fail('priority');
    if (row.due_time != null && (!TIME_RE.test(row.due_time) || row.due_date == null)) fail('due_time');
    if (!Array.isArray(row.reminders) || !Array.isArray(row.checklist)) fail('arrays');
    if (row.recurrence != null && (typeof row.recurrence !== 'object' || Array.isArray(row.recurrence))) fail('recurrence');
  }
}

export function createFakeServer({ minSchemaVersion = 3, now = () => new Date() } = {}) {
  let seq = 0;
  const users = new Map(); // userId → { tables: { [collection]: Map<id, row> }, purgedSeq }
  const accounts = new Map(); // e-posta → userId
  const changeListeners = new Set(); // { userId, listener } (Realtime taklidi)

  function user(userId) {
    if (!users.has(userId)) {
      users.set(userId, { purgedSeq: 0, tables: Object.fromEntries(SERVER_COLLECTIONS.map(c => [c, new Map()])) });
    }
    return users.get(userId);
  }

  function assertClient(userId, clientSchema) {
    if (!userId) throw new RemoteError('unauthenticated', 'not_authenticated');
    if (clientSchema == null || clientSchema < server.minSchemaVersion) {
      throw new RemoteError('outdated', 'client_outdated', server.minSchemaVersion);
    }
  }

  const server = {
    minSchemaVersion,
    users,

    push(userId, clientSchema, changes) {
      assertClient(userId, clientSchema);
      const tables = user(userId).tables;
      // Önce hepsi doğrulanır: kısıta uymayan tek kayıt tüm gönderimi reddeder.
      for (const collection of SERVER_COLLECTIONS) {
        for (const row of changes[collection] ?? []) validate(collection, row);
      }
      const written = {};
      for (const collection of SERVER_COLLECTIONS) {
        const newest = new Map();
        for (const row of changes[collection] ?? []) {
          const prev = newest.get(row.id);
          if (!prev || row.updated_at > prev.updated_at) newest.set(row.id, row);
        }
        written[collection] = [];
        for (const row of newest.values()) {
          const existing = tables[collection].get(row.id);
          if (existing && !(Date.parse(row.updated_at) > Date.parse(existing.updated_at))) continue;
          const stored = { ...row };
          for (const column of SERVER_ONLY) delete stored[column];
          delete stored.user_id;
          tables[collection].set(row.id, { ...stored, server_seq: ++seq, server_updated_at: now().toISOString() });
          written[collection].push(row.id);
        }
      }
      if (Object.values(written).some(ids => ids.length)) {
        for (const entry of changeListeners) {
          if (entry.userId === userId) setTimeout(entry.listener, 0);
        }
      }
      return { written };
    },

    pull(userId, clientSchema, since, lim = 500) {
      assertClient(userId, clientSchema);
      const pageSize = Math.min(Math.max(lim ?? 500, 1), 1000);
      const { tables, purgedSeq } = user(userId);
      const all = SERVER_COLLECTIONS.flatMap(collection =>
        [...tables[collection].values()].filter(r => r.server_seq > since).map(r => ({ collection, r })),
      ).sort((a, b) => a.r.server_seq - b.r.server_seq);
      const page = all.slice(0, pageSize);
      const records = page.map(({ collection, r }) => {
        const record = { ...r };
        for (const column of TIMESTAMP_COLUMNS) if (column in record) record[column] = pgTime(record[column]);
        record.server_updated_at = pgTime(record.server_updated_at);
        return { collection, record: JSON.parse(JSON.stringify(record)) };
      });
      return {
        records,
        next: page.length ? page[page.length - 1].r.server_seq : since,
        has_more: all.length > pageSize,
        purged_seq: purgedSeq,
      };
    },

    purgeDeleted(retentionDays = 30) {
      const cutoff = now().getTime() - retentionDays * DAY_MS;
      let removed = 0;
      for (const u of users.values()) {
        for (const table of Object.values(u.tables)) {
          for (const [id, row] of table) {
            if (row.deleted_at && Date.parse(row.server_updated_at) < cutoff) {
              table.delete(id);
              u.purgedSeq = Math.max(u.purgedSeq, row.server_seq);
              removed++;
            }
          }
        }
      }
      return removed;
    },

    deleteAccount(userId) {
      if (!userId) throw new RemoteError('unauthenticated', 'not_authenticated');
      users.delete(userId);
      for (const [email, id] of accounts) if (id === userId) accounts.delete(email);
    },

    // Aynı e-posta her zaman aynı kullanıcıdır (Supabase Auth gibi).
    userIdFor(email) {
      const key = email.trim().toLowerCase();
      if (!accounts.has(key)) accounts.set(key, `user-${accounts.size + 1}-${key}`);
      return accounts.get(key);
    },

    onChange(userId, listener) {
      const entry = { userId, listener };
      changeListeners.add(entry);
      return () => changeListeners.delete(entry);
    },

    // Kullanıcıya bağlı adaptör: motorun beklediği arayüz (bkz. engine.js).
    // online = false iken her çağrı ağ hatası verir.
    connect(userId) {
      const remote = {
        online: true,
        calls: [],
        check(name) {
          remote.calls.push(name);
          if (!remote.online) throw new RemoteError('network', 'offline');
        },
        async push(clientSchema, changes) {
          remote.check('push');
          return server.push(userId, clientSchema, JSON.parse(JSON.stringify(changes)));
        },
        async pull(clientSchema, since, lim) {
          remote.check('pull');
          return server.pull(userId, clientSchema, since, lim);
        },
        async deleteAccount() {
          remote.check('deleteAccount');
          server.deleteAccount(userId);
        },
      };
      return remote;
    },

    // Girişi de taklit eden adaptör (servis ve e2e için): e-postaya "gönderilen"
    // kod her zaman `code`'dur. Motorun çağrıları oturumdaki kullanıcıyla yapılır.
    createRemote({ code = '123456' } = {}) {
      let session = null;
      const sessionListeners = new Set();
      const sent = new Set();
      const setSession = next => {
        session = next;
        for (const listener of sessionListeners) listener(session);
      };
      const remote = {
        online: true,
        calls: [],
        check(name) {
          remote.calls.push(name);
          if (!remote.online) throw new RemoteError('network', 'offline');
        },
        async sendCode(email) {
          remote.check('sendCode');
          sent.add(email.trim().toLowerCase());
        },
        async verifyCode(email, token) {
          remote.check('verifyCode');
          const key = email.trim().toLowerCase();
          if (!sent.has(key) || token !== code) throw new RemoteError('invalidCode', 'invalid code');
          sent.delete(key);
          setSession({ userId: server.userIdFor(key), email: key });
          return session;
        },
        async getSession() {
          return session;
        },
        onSessionChange(listener) {
          sessionListeners.add(listener);
          return () => sessionListeners.delete(listener);
        },
        async signOut() {
          remote.calls.push('signOut');
          setSession(null);
        },
        async push(clientSchema, changes) {
          remote.check('push');
          return server.push(session?.userId, clientSchema, JSON.parse(JSON.stringify(changes)));
        },
        async pull(clientSchema, since, lim) {
          remote.check('pull');
          return server.pull(session?.userId, clientSchema, since, lim);
        },
        async deleteAccount() {
          remote.check('deleteAccount');
          server.deleteAccount(session?.userId);
        },
        subscribeChanges(userId, listener) {
          return server.onChange(userId, listener);
        },
        // Test yardımcısı: oturumun sunucu tarafında düşmesi (ör. yenileme anahtarı iptal).
        expireSession() {
          setSession(null);
        },
      };
      return remote;
    },

    // Test yardımcıları
    rows(userId, collection) {
      return [...user(userId).tables[collection].values()];
    },
  };
  return server;
}
