import { addDays, toDateKey, isValidDateKey } from './dates';
import { foldForSearch } from './text';
import { liveRecords } from './models';
import { strings } from '../strings';

// Hızlı ekleme satırını ayrıştırır:
//   "yarın 15:00 doktor #sağlık @iş !yüksek"
//   → { title: 'doktor', dueDate, dueTime: '15:00', tagNames: ['sağlık'], categoryId, priority: 3 }
// Tanınan ifadeler başlıktan çıkarılır; her türün yalnızca ilki kullanılır,
// sonrakiler başlıkta kalır. Tanınmayan @kategori da başlıkta kalır.

const q = strings.quickParse;
const fold = text => foldForSearch(text);
const foldAll = list => list.map(fold);

const TODAY = foldAll(q.today);
const TOMORROW = foldAll(q.tomorrow);
const NEXT_WEEK = foldAll(q.nextWeek);
// "öbür gün" gibi iki kelimelik ifadeler kelime dizisi olarak karşılaştırılır.
const DAY_AFTER = q.dayAfterTomorrow.map(p => fold(p).split(/\s+/));
const WEEKDAYS = foldAll(strings.dates.weekdays); // 0 = Pazar
const MONTHS_LONG = foldAll(strings.dates.monthsLong);
const MONTHS_SHORT = foldAll(strings.dates.monthsShort);
const TIME_WORD = fold(q.timeWord);
const PRIORITY_WORDS = Object.entries(q.priorities).flatMap(([level, words]) =>
  words.map(w => [fold(w), Number(level)]),
);

const TIME_RE = /^([01]?\d|2[0-3])[:.]([0-5]\d)$/;
const HOUR_RE = /^([01]?\d|2[0-3])$/;
const pad = n => String(n).padStart(2, '0');
// Cümle sonundaki noktalama işaretleri eşleşmeyi bozmasın ("yarın,").
const clean = word => fold(word.replace(/[.,;:!?]+$/, ''));

function monthIndex(word) {
  const w = clean(word);
  const i = MONTHS_LONG.indexOf(w);
  return i >= 0 ? i : MONTHS_SHORT.indexOf(w);
}

// Bugünden sonraki ilk o gün (bugün aynı günse bir hafta sonrası).
function nextWeekday(today, weekday) {
  const [y, m, d] = today.split('-').map(Number);
  const current = new Date(y, m - 1, d).getDay();
  const diff = (weekday - current + 7) % 7 || 7;
  return addDays(today, diff);
}

// Kelime dizisinin i. konumunda bir tarih ifadesi arar: { consumed, dueDate }
function matchDate(words, i, today) {
  const w = clean(words[i]);
  if (TODAY.includes(w)) return { consumed: 1, dueDate: today };
  if (TOMORROW.includes(w)) return { consumed: 1, dueDate: addDays(today, 1) };
  if (NEXT_WEEK.includes(w)) return { consumed: 1, dueDate: addDays(today, 7) };
  for (const phrase of DAY_AFTER) {
    const slice = words.slice(i, i + phrase.length).map(clean);
    if (slice.length === phrase.length && slice.every((x, k) => x === phrase[k])) {
      return { consumed: phrase.length, dueDate: addDays(today, 2) };
    }
  }
  const weekday = WEEKDAYS.indexOf(w);
  if (weekday >= 0) return { consumed: 1, dueDate: nextWeekday(today, weekday) };

  // "5 ekim" ya da "5 ekim 2027"; yıl yoksa ve tarih geçmişse gelecek yıl.
  if (/^\d{1,2}$/.test(words[i]) && i + 1 < words.length) {
    const month = monthIndex(words[i + 1]);
    if (month >= 0) {
      const day = Number(words[i]);
      const yearWord = words[i + 2]?.replace(/[.,;:!?]+$/, '');
      const hasYear = /^\d{4}$/.test(yearWord ?? '');
      let year = hasYear ? Number(yearWord) : Number(today.slice(0, 4));
      let key = `${year}-${pad(month + 1)}-${pad(day)}`;
      if (!isValidDateKey(key)) return null;
      if (!hasYear && key < today) key = `${year + 1}-${pad(month + 1)}-${pad(day)}`;
      if (!isValidDateKey(key)) return null; // 29 Şubat → gelecek yıl yoksa
      return { consumed: hasYear ? 3 : 2, dueDate: key };
    }
  }
  return null;
}

// "15:00", "15.30", "saat 15", "saat 9:30"
function matchTime(words, i) {
  const raw = words[i].replace(/[,;!?]+$/, '');
  const direct = TIME_RE.exec(raw);
  if (direct) return { consumed: 1, dueTime: `${pad(direct[1])}:${direct[2]}` };
  if (clean(words[i]) === TIME_WORD && i + 1 < words.length) {
    const next = words[i + 1].replace(/[.,;!?]+$/, '');
    const withMinutes = TIME_RE.exec(next);
    if (withMinutes) return { consumed: 2, dueTime: `${pad(withMinutes[1])}:${withMinutes[2]}` };
    const hour = HOUR_RE.exec(next);
    if (hour) return { consumed: 2, dueTime: `${pad(hour[1])}:00` };
  }
  return null;
}

function matchPriority(word) {
  const m = /^!(.+)$/.exec(word);
  if (!m) return null;
  if (/^[1-3]$/.test(m[1])) return Number(m[1]);
  const found = PRIORITY_WORDS.find(([w]) => w === clean(m[1]));
  return found ? found[1] : null;
}

function matchCategory(word, categories) {
  const m = /^@(.+)$/.exec(word);
  if (!m) return null;
  const wanted = clean(m[1]);
  // Çok kelimeli kategori adları boşluksuz yazılabilir: "@işprojeleri"
  const found = liveRecords(categories).find(c => fold(c.name).replace(/\s+/g, '') === wanted);
  return found ? found.id : null;
}

function matchTag(word) {
  const m = /^#([^\s#]+)$/.exec(word.replace(/[.,;:!?]+$/, ''));
  return m && /[\p{L}\p{N}]/u.test(m[1]) ? m[1] : null;
}

export function parseQuickAdd(text, { now = new Date(), categories = [] } = {}) {
  const today = toDateKey(now);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const result = { title: '', dueDate: null, dueTime: null, priority: null, categoryId: null, tagNames: [] };
  const titleWords = [];

  for (let i = 0; i < words.length; ) {
    const word = words[i];

    const tag = matchTag(word);
    if (tag) {
      if (!result.tagNames.some(t => fold(t) === fold(tag))) result.tagNames.push(tag);
      i += 1;
      continue;
    }
    if (result.priority == null) {
      const priority = matchPriority(word);
      if (priority != null) {
        result.priority = priority;
        i += 1;
        continue;
      }
    }
    if (result.categoryId == null) {
      const categoryId = matchCategory(word, categories);
      if (categoryId) {
        result.categoryId = categoryId;
        i += 1;
        continue;
      }
    }
    if (result.dueTime == null) {
      const time = matchTime(words, i);
      if (time) {
        result.dueTime = time.dueTime;
        i += time.consumed;
        continue;
      }
    }
    if (result.dueDate == null) {
      const date = matchDate(words, i, today);
      if (date) {
        result.dueDate = date.dueDate;
        i += date.consumed;
        continue;
      }
    }
    titleWords.push(word);
    i += 1;
  }

  result.title = titleWords.join(' ');
  return result;
}
