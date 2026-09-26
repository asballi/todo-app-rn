import { getRandomBytes } from 'expo-crypto';
import { sha1, utf8Bytes } from './sha1';

// Sistem kategorisi sabit ID kullanır: senkronizasyonda her cihaz aynı
// Gelen Kutusu'nu paylaşır, çift kayıt oluşmaz.
export const INBOX_ID = 'inbox';

// UUID v4. crypto.randomUUID yerine getRandomBytes kullanılır, çünkü web'de
// randomUUID yalnızca güvenli bağlamda (https/localhost) vardır.
export function newId() {
  const b = getRandomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return formatUuid(b);
}

function formatUuid(bytes) {
  const hex = Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function uuidBytes(uuid) {
  return uuid.replace(/-/g, '').match(/../g).map(h => parseInt(h, 16));
}

// UUID v5 (RFC 4122): ad alanı + ad → her yerde aynı kimlik.
export function uuidV5(name, namespace) {
  const hash = sha1([...uuidBytes(namespace), ...utf8Bytes(name)]).slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return formatUuid(hash);
}

// Uygulamanın ad alanı; değiştirilirse türetilen kimlikler cihazlar arasında tutmaz.
const APP_NAMESPACE = '0d7ce2e6-c483-4255-96cb-94657528f2a9';

// Senkronda iki cihazın ayrı ayrı oluşturduğu aynı kayıt tek kayıtta birleşsin
// diye (X13) bazı kimlikler rastgele değil, anlamlarından türetilir:
// tekrarlayan görevin sonraki tekrarı ve görev-etiket bağı.
export const nextOccurrenceId = taskId => uuidV5(`next:${taskId}`, APP_NAMESPACE);
export const taskTagId = (taskId, tagId) => uuidV5(`task-tag:${taskId}:${tagId}`, APP_NAMESPACE);

export function nowIso(now = new Date()) {
  return now.toISOString();
}
