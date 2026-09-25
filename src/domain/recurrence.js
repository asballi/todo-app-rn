import { addDays, parseDateKey, toDateKey } from './dates';

// Tekrar kuralı:
// { unit: 'day'|'week'|'month'|'year', interval: 1+, weekdays: number[]|null,
//   from: 'due'|'completion', monthDay: number|null }
// weekdays yalnızca 'week' içindir: 0 = Pazar … 6 = Cumartesi (Date#getDay).
// monthDay: aylık/yıllık seride serinin ilk günü; ay sonunda kısalan tarih
// (31 Ocak → 28 Şubat) sonraki ayda tekrar bu güne döner.

export const UNITS = ['day', 'week', 'month', 'year'];
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Pazartesi ile başlayan hafta
export const WEEKDAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const MAX_INTERVAL = 365;

export const PRESETS = [
  { key: 'daily', label: 'Her gün', rule: { unit: 'day', interval: 1, weekdays: null } },
  { key: 'weekdays', label: 'Hafta içi', rule: { unit: 'week', interval: 1, weekdays: [1, 2, 3, 4, 5] } },
  { key: 'weekly', label: 'Her hafta', rule: { unit: 'week', interval: 1, weekdays: null } },
  { key: 'monthly', label: 'Her ay', rule: { unit: 'month', interval: 1, weekdays: null } },
  { key: 'yearly', label: 'Her yıl', rule: { unit: 'year', interval: 1, weekdays: null } },
];

const dayOf = key => Number(key.slice(8, 10));
const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();
// Pazartesi = 0 … Pazar = 6
const mondayIndex = weekday => (weekday + 6) % 7;

// Kuralı doğrular ve eksikleri tamamlar. dueDate yoksa tekrar olmaz (null).
export function normalizeRecurrence(rule, dueDate) {
  if (!rule || !dueDate) return null;
  if (!UNITS.includes(rule.unit)) throw new Error('Geçersiz tekrar birimi');
  const interval = Number(rule.interval ?? 1);
  if (!Number.isInteger(interval) || interval < 1 || interval > MAX_INTERVAL) {
    throw new Error('Geçersiz tekrar aralığı');
  }
  let weekdays = null;
  if (rule.unit === 'week' && rule.weekdays?.length) {
    if (rule.weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Geçersiz gün');
    weekdays = [...new Set(rule.weekdays)].sort((a, b) => a - b);
  }
  const from = rule.from === 'completion' ? 'completion' : 'due';
  const monthDay = rule.unit === 'month' || rule.unit === 'year' ? rule.monthDay ?? dayOf(dueDate) : null;
  return { unit: rule.unit, interval, weekdays, from, monthDay };
}

// Kuraldaki bir sonraki tarih (dateKey'den sonra).
export function stepDate(dateKey, rule) {
  const { unit, interval, weekdays, monthDay } = rule;
  if (unit === 'day') return addDays(dateKey, interval);

  if (unit === 'week') {
    if (!weekdays) return addDays(dateKey, 7 * interval);
    const current = mondayIndex(parseDateKey(dateKey).getDay());
    const selected = weekdays.map(mondayIndex).sort((a, b) => a - b);
    const laterThisWeek = selected.find(i => i > current);
    if (laterThisWeek !== undefined) return addDays(dateKey, laterThisWeek - current);
    // Haftanın seçili günleri bitti: `interval` hafta sonrasının ilk seçili günü.
    return addDays(dateKey, -current + 7 * interval + selected[0]);
  }

  const date = parseDateKey(dateKey);
  const year = unit === 'year' ? date.getFullYear() + interval : date.getFullYear();
  const monthIndex = unit === 'month' ? date.getMonth() + interval : date.getMonth();
  const target = new Date(year, monthIndex, 1);
  const day = Math.min(monthDay ?? date.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
  return toDateKey(new Date(target.getFullYear(), target.getMonth(), day));
}

// Görev tamamlandığında oluşacak sonraki tekrarın bitiş tarihi.
// 'due': bitiş tarihinden ileri, bugünü geçene kadar atlanır.
// 'completion': tamamlandığı günden bir adım.
export function nextDueDate(task, completedAt = new Date(), now = new Date()) {
  const rule = task.recurrence;
  if (!rule || !task.dueDate) return null;
  if (rule.from === 'completion') return stepDate(toDateKey(completedAt), rule);
  const today = toDateKey(now);
  let next = stepDate(task.dueDate, rule);
  while (next <= today) next = stepDate(next, rule);
  return next;
}

export function presetKey(rule) {
  if (!rule) return 'none';
  const match = PRESETS.find(
    p =>
      p.rule.unit === rule.unit &&
      p.rule.interval === rule.interval &&
      String(p.rule.weekdays) === String(rule.weekdays ?? null),
  );
  return match ? match.key : 'custom';
}

const UNIT_NAMES = { day: 'gün', week: 'hafta', month: 'ay', year: 'yıl' };
const UNIT_EVERY = { day: 'Her gün', week: 'Her hafta', month: 'Her ay', year: 'Her yıl' };
// "Her 3 günde bir", "Her 2 haftada bir"
const everyN = (unit, n) => `Her ${n} ${UNIT_NAMES[unit]}${unit === 'day' ? 'de' : 'da'} bir`;

// "Her gün", "Hafta içi", "Her 2 haftada bir: Pzt, Çar", "Her ay (tamamlandıktan sonra)"
export function recurrenceLabel(rule) {
  if (!rule) return null;
  let label;
  const preset = PRESETS.find(p => p.key === presetKey(rule));
  if (preset) label = preset.label;
  else {
    label = rule.interval === 1 ? UNIT_EVERY[rule.unit] : everyN(rule.unit, rule.interval);
    if (rule.weekdays) {
      const days = WEEKDAY_ORDER.filter(d => rule.weekdays.includes(d)).map(d => WEEKDAYS_SHORT[d]);
      label += `: ${days.join(', ')}`;
    }
  }
  return rule.from === 'completion' ? `${label} (tamamlandıktan sonra)` : label;
}
