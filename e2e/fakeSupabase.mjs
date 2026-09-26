// Uçtan uca testler için sahte Supabase: uygulamadaki gerçek supabase-js adaptörü
// (src/sync/remote.supabase.js) bu sunucuyla konuşur. Veri mantığı Jest'te de
// kullanılan bellek içi sunucudur (src/sync/remote.fake.js); burada yalnızca
// Supabase'in HTTP ve WebSocket biçimleri taklit edilir:
//   - Auth:     POST /auth/v1/otp, /auth/v1/verify, /auth/v1/token, /auth/v1/logout
//   - RPC:      POST /rest/v1/rpc/{push,pull,delete_account} (PostgREST hata biçimiyle)
//   - Realtime: /realtime/v1/websocket (Phoenix, vsn 2.0.0; yalnızca postgres_changes)
// Gönderilen kod her zaman 123456'dır. Test denetimi için /__admin/* uç noktaları.
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { createFakeServer } from '../src/sync/remote.fake.js';

const port = Number(process.env.E2E_SUPABASE_PORT ?? 8124);
export const CODE = '123456';
// Belirteçler 2100'e kadar geçerli: tarayıcının saati testlerde sabitlendiği için
// yenileme hiç gerekmesin.
const EXPIRES_AT = 4102444800;

let data = createFakeServer();
let sessions = new Map(); // access_token → { userId, email }
let refreshTokens = new Map(); // refresh_token → { userId, email }
let codesSent = new Set();

const b64url = value => Buffer.from(JSON.stringify(value)).toString('base64url');

function createSession(email) {
  const userId = data.userIdFor(email);
  const accessToken = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: userId, email, role: 'authenticated', aud: 'authenticated', exp: EXPIRES_AT, session_id: randomUUID() }),
    Buffer.from(randomUUID()).toString('base64url'),
  ].join('.');
  const refreshToken = randomUUID();
  sessions.set(accessToken, { userId, email });
  refreshTokens.set(refreshToken, { userId, email });
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: EXPIRES_AT - Math.floor(Date.now() / 1000),
    expires_at: EXPIRES_AT,
    refresh_token: refreshToken,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

function userFrom(req) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  return sessions.get(token) ?? null;
}

// --- HTTP ---

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...cors() });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function cors(req) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': req?.headers['access-control-request-headers'] ?? '*',
    'Access-Control-Max-Age': '600',
  };
}

// RemoteError → PostgREST hatası (SQL'deki raise'lerin döndüreceği biçim)
function rpcError(res, e) {
  switch (e.kind) {
    case 'outdated':
      return send(res, 400, { code: 'P0001', message: 'client_outdated', details: String(e.detail), hint: null });
    case 'unauthenticated':
      return send(res, 403, { code: '28000', message: 'not_authenticated', details: null, hint: null });
    case 'rejected':
      return send(res, 400, { code: '23514', message: `violates check constraint: ${e.message}`, details: null, hint: null });
    default:
      return send(res, 500, { code: 'XX000', message: e.message, details: null, hint: null });
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

const routes = {
  'POST /auth/v1/otp': async (req, res, body) => {
    codesSent.add(body.email.trim().toLowerCase());
    send(res, 200, {});
  },
  'POST /auth/v1/verify': async (req, res, body) => {
    const email = (body.email ?? '').trim().toLowerCase();
    if (body.token !== CODE || !codesSent.has(email)) {
      return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    }
    codesSent.delete(email);
    send(res, 200, createSession(email));
  },
  'POST /auth/v1/token': async (req, res, body) => {
    const owner = refreshTokens.get(body.refresh_token);
    if (!owner) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
    refreshTokens.delete(body.refresh_token);
    send(res, 200, createSession(owner.email));
  },
  'POST /auth/v1/logout': async (req, res) => {
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    sessions.delete(token);
    res.writeHead(204, cors(req));
    res.end();
  },
  'GET /auth/v1/user': async (req, res) => {
    const user = userFrom(req);
    if (!user) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
    send(res, 200, { id: user.userId, aud: 'authenticated', role: 'authenticated', email: user.email });
  },
  'POST /rest/v1/rpc/push': async (req, res, body) => {
    const user = userFrom(req);
    try {
      send(res, 200, data.push(user?.userId, body.client_schema, body.changes ?? {}));
    } catch (e) {
      rpcError(res, e);
    }
  },
  'POST /rest/v1/rpc/pull': async (req, res, body) => {
    const user = userFrom(req);
    try {
      send(res, 200, data.pull(user?.userId, body.client_schema, body.since, body.lim));
    } catch (e) {
      rpcError(res, e);
    }
  },
  'POST /rest/v1/rpc/delete_account': async (req, res) => {
    const user = userFrom(req);
    try {
      data.deleteAccount(user?.userId);
    } catch (e) {
      return rpcError(res, e);
    }
    for (const [token, owner] of sessions) if (owner.userId === user.userId) sessions.delete(token);
    res.writeHead(204, cors(req));
    res.end();
  },

  // --- Test denetimi ---
  'GET /__admin/health': async (req, res) => send(res, 200, { ok: true }),
  'POST /__admin/reset': async (req, res) => {
    data = createFakeServer();
    sessions = new Map();
    refreshTokens = new Map();
    codesSent = new Set();
    for (const sub of subscriptions) sub.unsubscribe();
    subscriptions.clear();
    send(res, 200, { ok: true });
  },
  'POST /__admin/min-schema': async (req, res, body) => {
    data.minSchemaVersion = body.version;
    send(res, 200, { ok: true });
  },
  // Bir kullanıcının satırları: { email, collection }
  'POST /__admin/rows': async (req, res, body) => {
    const userId = data.userIdFor(body.email);
    send(res, 200, data.users.has(userId) ? data.rows(userId, body.collection) : []);
  },
  'POST /__admin/users': async (req, res) => send(res, 200, [...data.users.keys()]),
};

const httpServer = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors(req));
    return res.end();
  }
  const path = req.url.split('?')[0];
  const route = routes[`${req.method} ${path}`];
  if (!route) return send(res, 404, { message: `bilinmeyen uç: ${req.method} ${path}` });
  try {
    await route(req, res, req.method === 'POST' ? await readBody(req) : {});
  } catch (e) {
    send(res, 500, { message: e.message });
  }
});

// --- Realtime (Phoenix, vsn 2.0.0: [join_ref, ref, topic, event, payload]) ---

const subscriptions = new Set();
const wss = new WebSocketServer({ server: httpServer, path: '/realtime/v1/websocket' });

wss.on('connection', ws => {
  const reply = (joinRef, ref, topic, status, response = {}) =>
    ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status, response }]));

  ws.on('message', raw => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const [joinRef, ref, topic, event, payload] = message;
    if (topic === 'phoenix' && event === 'heartbeat') return reply(null, ref, topic, 'ok');
    if (event === 'phx_leave') {
      for (const sub of subscriptions) {
        if (sub.ws === ws && sub.topic === topic) {
          sub.unsubscribe();
          subscriptions.delete(sub);
        }
      }
      return reply(joinRef, ref, topic, 'ok');
    }
    if (event !== 'phx_join') return undefined; // access_token vb.
    const user = sessions.get(payload?.access_token);
    if (!user) return reply(joinRef, ref, topic, 'error', { reason: 'unauthorized' });
    const bindings = (payload.config?.postgres_changes ?? []).map((filter, i) => ({ ...filter, id: i + 1 }));
    reply(joinRef, ref, topic, 'ok', { postgres_changes: bindings });
    const sub = {
      ws,
      topic,
      unsubscribe: data.onChange(user.userId, () => {
        if (ws.readyState !== ws.OPEN) return;
        ws.send(JSON.stringify([joinRef, null, topic, 'postgres_changes', {
          ids: bindings.map(b => b.id),
          data: {
            type: 'UPDATE', schema: 'public', table: 'tasks', commit_timestamp: new Date().toISOString(),
            columns: [], record: {}, old_record: {}, errors: null,
          },
        }]));
      }),
    };
    subscriptions.add(sub);
    return undefined;
  });

  ws.on('close', () => {
    for (const sub of subscriptions) {
      if (sub.ws === ws) {
        sub.unsubscribe();
        subscriptions.delete(sub);
      }
    }
  });
});

httpServer.listen(port, () => console.log(`sahte Supabase: http://localhost:${port}`));
