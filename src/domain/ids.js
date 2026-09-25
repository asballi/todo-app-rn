import { getRandomBytes } from 'expo-crypto';

// Sistem kategorisi sabit ID kullanır: senkronizasyonda her cihaz aynı
// Gelen Kutusu'nu paylaşır, çift kayıt oluşmaz.
export const INBOX_ID = 'inbox';

// UUID v4. crypto.randomUUID yerine getRandomBytes kullanılır, çünkü web'de
// randomUUID yalnızca güvenli bağlamda (https/localhost) vardır.
export function newId() {
  const b = getRandomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function nowIso(now = new Date()) {
  return now.toISOString();
}
