import {
  toDateKey,
  isValidDateKey,
  isValidTime,
  parseDateKey,
  addDays,
  dueAt,
  isOverdue,
  isCompletedOn,
  formatDueLabel,
} from '../dates';

describe('tarih anahtarları', () => {
  test('saat dilimi UTC gerisinde olsa da gün kaymaz', () => {
    expect(new Date().getTimezoneOffset()).toBeGreaterThan(0);
    expect(toDateKey(parseDateKey('2026-09-25'))).toBe('2026-09-25');
  });

  test('gece geç saatte yerel gün kullanılır', () => {
    expect(toDateKey(new Date(2026, 8, 25, 23, 30))).toBe('2026-09-25');
  });

  test('geçerli ve geçersiz tarihler', () => {
    expect(isValidDateKey('2026-02-28')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-9-5')).toBe(false);
    expect(isValidDateKey(null)).toBe(false);
  });

  test('geçerli ve geçersiz saatler', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:00')).toBe(false);
  });

  test('addDays ay/yıl sınırını ve yaz saati geçişini aşar', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    // New York'ta 8 Mart 2026 yaz saatine geçiş günü.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  });
});

describe('gecikme', () => {
  const task = fields => ({ completedAt: null, dueDate: null, dueTime: null, ...fields });

  test('saatsiz görev gün bitene kadar gecikmiş sayılmaz', () => {
    const t = task({ dueDate: '2026-09-25' });
    expect(isOverdue(t, new Date(2026, 8, 25, 23, 59))).toBe(false);
    expect(isOverdue(t, new Date(2026, 8, 26, 0, 0))).toBe(true);
  });

  test('saatli görev o saat geçince gecikmiş sayılır', () => {
    const t = task({ dueDate: '2026-09-25', dueTime: '15:00' });
    expect(isOverdue(t, new Date(2026, 8, 25, 15, 0))).toBe(false);
    expect(isOverdue(t, new Date(2026, 8, 25, 15, 1))).toBe(true);
  });

  test('tamamlanan ve tarihsiz görevler gecikmiş sayılmaz', () => {
    const later = new Date(2030, 0, 1);
    expect(isOverdue(task({ dueDate: '2026-09-25', completedAt: 'x' }), later)).toBe(false);
    expect(isOverdue(task({}), later)).toBe(false);
  });

  test('dueAt: tarihsiz görev için null', () => {
    expect(dueAt(task({}))).toBeNull();
  });

  test('isCompletedOn yerel güne göre karşılaştırır', () => {
    // 26 Eylül 02:00 UTC = New York'ta 25 Eylül 22:00
    const t = task({ completedAt: '2026-09-26T02:00:00.000Z' });
    expect(isCompletedOn(t, '2026-09-25')).toBe(true);
    expect(isCompletedOn(t, '2026-09-26')).toBe(false);
  });
});

describe('formatDueLabel', () => {
  const now = new Date(2026, 8, 25, 10, 0);
  const label = (dueDate, dueTime = null) => formatDueLabel({ dueDate, dueTime }, now);

  test('göreli günler', () => {
    expect(label('2026-09-25')).toBe('Bugün');
    expect(label('2026-09-26', '15:00')).toBe('Yarın 15:00');
    expect(label('2026-09-24')).toBe('Dün');
  });

  test('aynı yıl ve farklı yıl', () => {
    expect(label('2026-10-03')).toBe('3 Eki');
    expect(label('2027-01-03', '09:30')).toBe('3 Oca 2027 09:30');
  });

  test('tarihsiz görev', () => {
    expect(label(null)).toBeNull();
  });
});
