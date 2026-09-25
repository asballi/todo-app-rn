// Bitiş tarihleri yerel metin olarak tutulur: dueDate "YYYY-MM-DD", dueTime "HH:mm".
// new Date("YYYY-MM-DD") kullanma: UTC gece yarısı olarak yorumlanır ve
// UTC'nin gerisindeki saat dilimlerinde bir önceki güne kayar.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const pad = n => String(n).padStart(2, '0');

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isValidDateKey(key) {
  const m = DATE_RE.exec(key ?? '');
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toDateKey(d) === key;
}

export function isValidTime(time) {
  return TIME_RE.test(time ?? '');
}

// Yerel saatle Date döndürür; saat verilmezse günün başı.
export function parseDateKey(key, time = null) {
  const [y, m, d] = key.split('-').map(Number);
  const [hh, mm] = time ? time.split(':').map(Number) : [0, 0];
  return new Date(y, m - 1, d, hh, mm);
}

export function addDays(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + days));
}

// Görevin gecikmiş sayılmaya başladığı an. Saatsiz görev ertesi günün
// başında, saatli görev o saatte gecikir. Tarihsiz görev için null.
export function dueAt(task) {
  if (!task.dueDate) return null;
  if (task.dueTime) return parseDateKey(task.dueDate, task.dueTime);
  return parseDateKey(addDays(task.dueDate, 1));
}

export function isOverdue(task, now = new Date()) {
  if (task.completedAt || !task.dueDate) return false;
  const deadline = dueAt(task);
  return task.dueTime ? now > deadline : now >= deadline;
}

export function isDueOn(task, dateKey) {
  return task.dueDate === dateKey;
}

export function isCompletedOn(task, dateKey) {
  return !!task.completedAt && toDateKey(new Date(task.completedAt)) === dateKey;
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// "Bugün", "Yarın 15:00", "25 Eyl", "3 Oca 2027". Tarihsiz görev için null.
export function formatDueLabel(task, now = new Date()) {
  if (!task.dueDate) return null;
  const today = toDateKey(now);
  let label;
  if (task.dueDate === today) label = 'Bugün';
  else if (task.dueDate === addDays(today, 1)) label = 'Yarın';
  else if (task.dueDate === addDays(today, -1)) label = 'Dün';
  else {
    const [y, m, d] = task.dueDate.split('-').map(Number);
    label = `${d} ${MONTHS[m - 1]}`;
    if (y !== now.getFullYear()) label += ` ${y}`;
  }
  return task.dueTime ? `${label} ${task.dueTime}` : label;
}

export function toTimeString(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Görev formundaki hızlı tarih seçenekleri.
export function quickDueDates(now = new Date()) {
  const today = toDateKey(now);
  return [
    { label: 'Bugün', value: today },
    { label: 'Yarın', value: addDays(today, 1) },
    { label: 'Gelecek hafta', value: addDays(today, 7) },
  ];
}

const MONTHS_LONG = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

// "Cuma, 25 Eylül"
export function formatLongDate(date) {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`;
}

// Yaklaşan listesindeki gün başlıkları: { title: "Yarın" | "Pazartesi", subtitle: "28 Eylül" }
export function formatDayHeader(dateKey, now = new Date()) {
  const date = parseDateKey(dateKey);
  const title = dateKey === addDays(toDateKey(now), 1) ? 'Yarın' : WEEKDAYS[date.getDay()];
  return { title, subtitle: `${date.getDate()} ${MONTHS_LONG[date.getMonth()]}` };
}
