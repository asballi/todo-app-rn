// Silinmiş kayıtların yerel temizliği (X10): deletedAt'ı saklama süresinden eski
// kayıtlar kalıcı silinir. Gönderme kuyruğundaki kayıtlar, sunucuya ulaşana kadar
// tutulur (keep).
export const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function expiredIds(records, now = new Date(), keep = () => false) {
  const cutoff = now.getTime() - RETENTION_DAYS * DAY_MS;
  return records
    .filter(r => r.deletedAt && Date.parse(r.deletedAt) < cutoff && !keep(r.id))
    .map(r => r.id);
}
