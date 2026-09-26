import { createSupabaseRemote, toRemoteError, toAuthError } from '../remote.supabase';

test('RPC hataları motorun türlerine çevrilir', () => {
  expect(toRemoteError({ message: 'client_outdated', code: 'P0001', details: '4' })).toMatchObject({ kind: 'outdated', detail: 4 });
  expect(toRemoteError({ message: 'not_authenticated', code: '28000' }).kind).toBe('unauthenticated');
  expect(toRemoteError({ message: 'JWT expired', code: 'PGRST301' }).kind).toBe('unauthenticated');
  expect(toRemoteError({ message: 'x' }, 401).kind).toBe('unauthenticated');
  expect(toRemoteError({ message: 'violates check constraint', code: '23514' }).kind).toBe('rejected');
  expect(toRemoteError({ message: 'invalid input syntax', code: '22P02' }).kind).toBe('rejected');
  expect(toRemoteError({ message: 'TypeError: fetch failed', code: '' }).kind).toBe('network');
  expect(toRemoteError({ message: 'boom', code: 'XX000' }, 500).kind).toBe('network');
});

test('giriş hataları', () => {
  expect(toAuthError({ status: 429, message: 'rate' }).kind).toBe('rateLimited');
  expect(toAuthError({ status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' }).kind).toBe('invalidCode');
  expect(toAuthError({ status: 0, message: 'fetch failed' }).kind).toBe('network');
});

function fakeClient() {
  const calls = [];
  const channels = [];
  const client = {
    calls,
    channels,
    rpcResult: { data: { written: {} }, error: null, status: 200 },
    rpc: jest.fn(async (name, args) => {
      calls.push([name, args]);
      if (client.rpcThrows) throw new Error('offline');
      return client.rpcResult;
    }),
    auth: {
      signInWithOtp: jest.fn(async () => ({ error: null })),
      verifyOtp: jest.fn(async () => ({ data: { session: { user: { id: 'u1', email: 'a@b.c' } } }, error: null })),
      getSession: jest.fn(async () => ({ data: { session: null } })),
      signOut: jest.fn(async () => ({ error: null })),
      onAuthStateChange: jest.fn(listener => {
        client.authListener = listener;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
    channel: jest.fn(name => {
      const channel = {
        name,
        handlers: [],
        on: jest.fn((type, filter, handler) => { channel.handlers.push({ type, filter, handler }); return channel; }),
        subscribe: jest.fn(callback => { channel.statusCallback = callback; return channel; }),
      };
      channels.push(channel);
      return channel;
    }),
    removeChannel: jest.fn(),
  };
  return client;
}

test('push / pull / deleteAccount doğru RPC ve parametrelerle çağrılır', async () => {
  const client = fakeClient();
  const remote = createSupabaseRemote({ client });
  await remote.push(3, { tasks: [] });
  client.rpcResult = { data: { records: [], next: 5, has_more: false, purged_seq: 0 }, error: null };
  expect(await remote.pull(3, 2, 500)).toEqual({ records: [], next: 5, has_more: false, purged_seq: 0 });
  await remote.deleteAccount();
  expect(client.calls).toEqual([
    ['push', { client_schema: 3, changes: { tasks: [] } }],
    ['pull', { client_schema: 3, since: 2, lim: 500 }],
    ['delete_account', undefined],
  ]);
});

test('RPC hatası ve bağlantı istisnası RemoteError olur', async () => {
  const client = fakeClient();
  const remote = createSupabaseRemote({ client });
  client.rpcResult = { data: null, error: { message: 'client_outdated', code: 'P0001', details: '4' }, status: 400 };
  await expect(remote.pull(3, 0, 10)).rejects.toMatchObject({ name: 'RemoteError', kind: 'outdated', detail: 4 });
  client.rpcThrows = true;
  await expect(remote.push(3, {})).rejects.toMatchObject({ kind: 'network' });
});

test('giriş: kod gönderme, doğrulama, oturum ve yalnızca bu cihazdan çıkış', async () => {
  const client = fakeClient();
  const remote = createSupabaseRemote({ client });
  await remote.sendCode('a@b.c');
  expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.c', options: { shouldCreateUser: true } });
  expect(await remote.verifyCode('a@b.c', '123456')).toEqual({ userId: 'u1', email: 'a@b.c' });
  expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.c', token: '123456', type: 'email' });
  expect(await remote.getSession()).toBeNull();

  const sessions = [];
  const unsubscribe = remote.onSessionChange(s => sessions.push(s));
  client.authListener('SIGNED_OUT', null);
  client.authListener('TOKEN_REFRESHED', { user: { id: 'u1', email: 'a@b.c' } });
  expect(sessions).toEqual([null, { userId: 'u1', email: 'a@b.c' }]);
  unsubscribe();

  await remote.signOut();
  expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });

  client.auth.verifyOtp.mockResolvedValueOnce({ data: {}, error: { status: 403, message: 'expired' } });
  await expect(remote.verifyCode('a@b.c', '000000')).rejects.toMatchObject({ kind: 'invalidCode' });
});

test('Realtime: dört tablo kullanıcı filtresiyle dinlenir; bağlanınca ve değişiklikte sinyal', () => {
  const client = fakeClient();
  const remote = createSupabaseRemote({ client });
  const listener = jest.fn();
  const unsubscribe = remote.subscribeChanges('u1', listener);
  const [channel] = client.channels;
  expect(channel.handlers.map(h => [h.type, h.filter.table, h.filter.filter])).toEqual([
    ['postgres_changes', 'tasks', 'user_id=eq.u1'],
    ['postgres_changes', 'categories', 'user_id=eq.u1'],
    ['postgres_changes', 'tags', 'user_id=eq.u1'],
    ['postgres_changes', 'task_tags', 'user_id=eq.u1'],
  ]);
  channel.statusCallback('SUBSCRIBED');
  channel.handlers[0].handler({});
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  expect(client.removeChannel).toHaveBeenCalledWith(channel);
});
