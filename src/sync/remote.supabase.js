import './polyfills';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { RemoteError } from './errors';

// Supabase adaptörü: motorun `remote` arayüzü (push / pull / deleteAccount /
// signOut) + giriş (e-posta kodu) + Realtime. SQL tarafı supabase/migrations/.

const REALTIME_TABLES = ['tasks', 'categories', 'tags', 'task_tags'];

// PostgREST / RPC hatasını motorun anladığı türe çevirir.
export function toRemoteError(error, status) {
  const code = error?.code ?? '';
  const message = error?.message ?? String(error);
  if (message === 'client_outdated') {
    return new RemoteError('outdated', message, Number(error.details) || null);
  }
  if (message === 'not_authenticated' || code === '28000' || code.startsWith('PGRST3') || status === 401) {
    return new RemoteError('unauthenticated', message);
  }
  if (code.startsWith('22') || code.startsWith('23')) {
    return new RemoteError('rejected', message, error.details ?? null);
  }
  return new RemoteError('network', message);
}

// Giriş (Auth) hatası: kod hatalı / süresi geçmiş, çok sık istek, diğerleri ağ.
export function toAuthError(error) {
  const status = error?.status ?? 0;
  const message = error?.message ?? String(error);
  if (status === 429 || error?.code === 'over_email_send_rate_limit') return new RemoteError('rateLimited', message);
  if (status >= 400 && status < 500) return new RemoteError('invalidCode', message);
  return new RemoteError('network', message);
}

const toSession = session =>
  session?.user ? { userId: session.user.id, email: session.user.email ?? '' } : null;

export function createSupabaseRemote({ url, key, client: injected } = {}) {
  const client =
    injected ??
    createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

  async function rpc(name, args) {
    let result;
    try {
      result = await client.rpc(name, args);
    } catch (e) {
      throw new RemoteError('network', e?.message ?? String(e));
    }
    if (result.error) throw toRemoteError(result.error, result.status);
    return result.data;
  }

  return {
    client,

    // --- Giriş ---

    async sendCode(email) {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw toAuthError(error);
    },

    async verifyCode(email, token) {
      const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw toAuthError(error);
      return toSession(data.session);
    },

    async getSession() {
      const { data } = await client.auth.getSession();
      return toSession(data.session);
    },

    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(toSession(session)));
      return () => data.subscription.unsubscribe();
    },

    // Yalnızca bu cihazın oturumu kapanır; diğer cihazlar girişli kalır. auth-js
    // sunucuya ulaşamasa da (çevrimdışı çıkış) yerel oturumu siler ve yalnızca hata
    // döndürür; sunucudaki oturum süresi dolunca kendiliğinden düşer. Bu yüzden hata
    // yok sayılır.
    async signOut() {
      await client.auth.signOut({ scope: 'local' });
    },

    // Mobilde uygulama arka plandayken oturum yenileme durdurulur (Supabase önerisi).
    setAutoRefresh(active) {
      if (active) client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    },

    // --- Senkron ---

    push(clientSchema, changes) {
      return rpc('push', { client_schema: clientSchema, changes });
    },

    pull(clientSchema, since, lim) {
      return rpc('pull', { client_schema: clientSchema, since, lim });
    },

    deleteAccount() {
      return rpc('delete_account');
    },

    // Realtime: kullanıcının tablolarında bir değişiklik olunca listener çağrılır
    // (içerik kullanılmaz, yalnızca "şimdi çek" sinyalidir). Bağlanınca da bir kez
    // çağrılır: bağlantı yokken kaçırılanlar alınsın.
    subscribeChanges(userId, listener) {
      const channel = client.channel(`sync:${userId}`);
      for (const table of REALTIME_TABLES) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
          () => listener(),
        );
      }
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') listener();
      });
      return () => {
        client.removeChannel(channel);
      };
    },
  };
}
