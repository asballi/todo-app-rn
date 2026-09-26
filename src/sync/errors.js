// Sunucu adaptörlerinin (sahte ve Supabase) fırlattığı hata. Motor türüne göre davranır:
//   outdated        → uygulamanın şema sürümü eski; senkron durur (X8)
//   unauthenticated → oturum yok ya da süresi dolmuş
//   rejected        → kayıt sunucu kısıtına uymuyor (Postgres 22xxx / 23xxx)
//   network         → bağlantı ya da sunucu hatası; sonra yeniden denenir
// Giriş sırasında ayrıca:
//   invalidCode     → kod hatalı ya da süresi geçmiş
//   rateLimited     → çok sık kod istendi
export class RemoteError extends Error {
  constructor(kind, message, detail = null) {
    super(message);
    this.name = 'RemoteError';
    this.kind = kind;
    this.detail = detail;
  }
}

// instanceof yerine ad kontrolü: hata başka bir modül kopyasından (ör. testlerde
// ayrı yüklenen sahte sunucu) gelse de tanınır.
export const isRemoteError = (e, kind) => e?.name === 'RemoteError' && (!kind || e.kind === kind);
