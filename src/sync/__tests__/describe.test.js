import { formatSyncTime, describeSync, summarizeAccount } from '../describe';

const NOW = new Date(2026, 8, 25, 14, 30);
const base = { phase: 'idle', pending: 0, blocked: 0, lastSyncedAt: null, error: null, errorKind: null };

test('son eşitleme zamanı', () => {
  expect(formatSyncTime(new Date(2026, 8, 25, 14, 29, 30).toISOString(), NOW)).toBe('az önce');
  expect(formatSyncTime(new Date(2026, 8, 25, 14, 25).toISOString(), NOW)).toBe('5 dk önce');
  expect(formatSyncTime(new Date(2026, 8, 25, 9, 5).toISOString(), NOW)).toBe('09:05');
  expect(formatSyncTime(new Date(2026, 8, 24, 9, 5).toISOString(), NOW)).toBe('24 Eyl 09:05');
});

test('durum satırları', () => {
  expect(describeSync(base, NOW)).toEqual([{ text: 'Henüz eşitlenmedi.', tone: 'normal' }]);
  expect(describeSync({ ...base, phase: 'syncing', pending: 3 }, NOW)).toEqual([
    { text: 'Eşitleniyor…', tone: 'normal' },
    { text: '3 değişiklik gönderilmeyi bekliyor.', tone: 'normal' },
  ]);
  expect(describeSync({ ...base, phase: 'error', errorKind: 'network', pending: 2, blocked: 1 }, NOW).map(l => l.tone))
    .toEqual(['error', 'normal', 'normal', 'warning']);
  expect(describeSync({ ...base, phase: 'error', errorKind: 'unknown', error: 'boom' }, NOW)[0].text).toBe('Eşitleme hatası: boom');
  expect(describeSync({ ...base, phase: 'outdated' }, NOW)[0].tone).toBe('error');
});

test('Ayarlar özeti', () => {
  expect(summarizeAccount({ configured: false })).toBe('Senkronizasyon yapılandırılmadı.');
  expect(summarizeAccount({ configured: true, signedIn: true, email: 'a@b.c' })).toBe('a@b.c ile eşitleniyor.');
  expect(summarizeAccount({ configured: true, sessionExpired: true })).toMatch('yeniden giriş');
  expect(summarizeAccount({ configured: true })).toMatch('Giriş yapılmadı');
});
