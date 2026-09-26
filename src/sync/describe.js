import { strings } from '../strings';
import { toTimeString } from '../domain/dates';

const t = strings.account;

// Son eşitleme zamanı: "az önce", "5 dk önce", "14:05", "24 Eyl 14:05"
export function formatSyncTime(iso, now = new Date()) {
  const date = new Date(iso);
  const minutes = Math.floor((now - date) / 60000);
  if (minutes < 1) return t.status.justNow;
  if (minutes < 60) return t.status.minutesAgo(minutes);
  const time = toTimeString(date);
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay ? time : `${date.getDate()} ${strings.dates.monthsShort[date.getMonth()]} ${time}`;
}

// Hesap ekranında gösterilecek durum satırları: [{ text, tone: 'normal' | 'warning' | 'error' }]
export function describeSync(sync, now = new Date()) {
  const lines = [];
  if (sync.phase === 'syncing') lines.push({ text: t.status.syncing, tone: 'normal' });
  else if (sync.phase === 'outdated') lines.push({ text: t.status.outdated, tone: 'error' });
  else if (sync.phase === 'error') {
    const text = t.status[sync.errorKind] ?? t.status.unknown(sync.error);
    lines.push({ text: typeof text === 'function' ? text(sync.error) : text, tone: 'error' });
  }
  if (sync.phase !== 'syncing') {
    lines.push({
      text: sync.lastSyncedAt ? t.status.lastSynced(formatSyncTime(sync.lastSyncedAt, now)) : t.status.never,
      tone: 'normal',
    });
  }
  const waiting = sync.pending - sync.blocked;
  if (waiting > 0) lines.push({ text: t.status.pending(waiting), tone: 'normal' });
  if (sync.blocked > 0) lines.push({ text: t.status.blocked(sync.blocked), tone: 'warning' });
  return lines;
}

// Ayarlar'daki tek satırlık özet.
export function summarizeAccount(state) {
  if (!state.configured) return t.notConfigured;
  if (state.signedIn) return t.signedInSummary(state.email);
  if (state.sessionExpired) return t.expiredSummary;
  return t.signedOutSummary;
}
