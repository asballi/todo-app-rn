import {
  normalizeRecurrence,
  stepDate,
  nextDueDate,
  presetKey,
  recurrenceLabel,
} from '../recurrence';

const rule = (fields, dueDate = '2026-09-25') =>
  normalizeRecurrence({ unit: 'day', interval: 1, ...fields }, dueDate);

describe('normalizeRecurrence', () => {
  test('tarih yoksa tekrar olmaz', () => {
    expect(normalizeRecurrence({ unit: 'day', interval: 1 }, null)).toBeNull();
    expect(normalizeRecurrence(null, '2026-09-25')).toBeNull();
  });

  test('varsayılanları tamamlar', () => {
    expect(rule({})).toEqual({ unit: 'day', interval: 1, weekdays: null, from: 'due', monthDay: null });
    expect(rule({ unit: 'month' }, '2026-01-31').monthDay).toBe(31);
    expect(rule({ unit: 'month', monthDay: 30 }, '2026-02-28').monthDay).toBe(30);
  });

  test('gün seçimi yalnızca haftalıkta, tekilleştirilmiş ve sıralı', () => {
    expect(rule({ unit: 'week', weekdays: [5, 1, 5] }).weekdays).toEqual([1, 5]);
    expect(rule({ unit: 'week', weekdays: [] }).weekdays).toBeNull();
    expect(rule({ unit: 'day', weekdays: [1] }).weekdays).toBeNull();
  });

  test('geçersiz değerleri reddeder', () => {
    expect(() => rule({ unit: 'hour' })).toThrow('birimi');
    expect(() => rule({ interval: 0 })).toThrow('aralığı');
    expect(() => rule({ interval: 1.5 })).toThrow('aralığı');
    expect(() => rule({ unit: 'week', weekdays: [7] })).toThrow('gün');
  });
});

describe('stepDate', () => {
  test('günlük ve N günlük', () => {
    expect(stepDate('2026-09-25', rule({}))).toBe('2026-09-26');
    expect(stepDate('2026-09-29', rule({ interval: 3 }))).toBe('2026-10-02');
  });

  test('haftalık, gün seçimi olmadan', () => {
    expect(stepDate('2026-09-25', rule({ unit: 'week' }))).toBe('2026-10-02');
    expect(stepDate('2026-09-25', rule({ unit: 'week', interval: 2 }))).toBe('2026-10-09');
  });

  test('hafta içi: Cuma → Pazartesi, Pazartesi → Salı', () => {
    const weekdays = rule({ unit: 'week', weekdays: [1, 2, 3, 4, 5] });
    expect(stepDate('2026-09-25', weekdays)).toBe('2026-09-28'); // Cuma → Pzt
    expect(stepDate('2026-09-28', weekdays)).toBe('2026-09-29'); // Pzt → Sal
    expect(stepDate('2026-09-26', weekdays)).toBe('2026-09-28'); // Cmt → Pzt
  });

  test('iki haftada bir Pzt ve Çar', () => {
    const r = rule({ unit: 'week', interval: 2, weekdays: [1, 3] });
    expect(stepDate('2026-09-28', r)).toBe('2026-09-30'); // Pzt → aynı haftanın Çar
    expect(stepDate('2026-09-30', r)).toBe('2026-10-12'); // Çar → iki hafta sonraki Pzt
  });

  test('Pazar seçiliyse haftanın son günü sayılır', () => {
    const r = rule({ unit: 'week', weekdays: [0, 6] });
    expect(stepDate('2026-09-26', r)).toBe('2026-09-27'); // Cmt → Paz
    expect(stepDate('2026-09-27', r)).toBe('2026-10-03'); // Paz → sonraki Cmt
  });

  test('aylık: ay sonu kısalır ve serinin gününe geri döner', () => {
    const r = rule({ unit: 'month' }, '2026-01-31');
    expect(stepDate('2026-01-31', r)).toBe('2026-02-28');
    expect(stepDate('2026-02-28', r)).toBe('2026-03-31');
    expect(stepDate('2026-03-31', r)).toBe('2026-04-30');
    expect(stepDate('2026-12-31', r)).toBe('2027-01-31');
  });

  test('üç ayda bir yıl sınırını aşar', () => {
    expect(stepDate('2026-11-15', rule({ unit: 'month', interval: 3 }, '2026-11-15'))).toBe('2027-02-15');
  });

  test('yıllık: 29 Şubat artık olmayan yılda 28 Şubat, artık yılda geri döner', () => {
    const r = rule({ unit: 'year' }, '2028-02-29');
    expect(stepDate('2028-02-29', r)).toBe('2029-02-28');
    expect(stepDate('2031-02-28', r)).toBe('2032-02-29');
  });

  test('yaz saati geçişinde gün kaymaz (New York, 8 Mart)', () => {
    expect(stepDate('2026-03-07', rule({}))).toBe('2026-03-08');
    expect(stepDate('2026-03-01', rule({ unit: 'week' }))).toBe('2026-03-08');
  });
});

describe('nextDueDate', () => {
  const NOW = new Date(2026, 8, 25, 10, 0); // Cuma 25 Eylül
  const task = (dueDate, fields) => ({ dueDate, recurrence: rule(fields, dueDate) });

  test('zamanında tamamlanan günlük görev yarına', () => {
    expect(nextDueDate(task('2026-09-25', {}), NOW, NOW)).toBe('2026-09-26');
  });

  test('erken tamamlanan görev kendi tarihinden bir adım', () => {
    expect(nextDueDate(task('2026-09-27', {}), NOW, NOW)).toBe('2026-09-28');
  });

  test('gecikmiş günlük görev geçmiş kopyalar üretmeden yarına atlar', () => {
    expect(nextDueDate(task('2026-09-20', {}), NOW, NOW)).toBe('2026-09-26');
  });

  test('gecikmiş haftalık görev aynı hafta gününe atlar', () => {
    // 11 Eylül Cuma, her hafta → 25 Eylül bugün olduğu için 2 Ekim
    expect(nextDueDate(task('2026-09-11', { unit: 'week' }), NOW, NOW)).toBe('2026-10-02');
  });

  test('tamamlanma tarihinden sayma', () => {
    expect(nextDueDate(task('2026-09-10', { interval: 3, from: 'completion' }), NOW, NOW)).toBe('2026-09-28');
  });

  test('tekrar ya da tarih yoksa null', () => {
    expect(nextDueDate({ dueDate: '2026-09-25', recurrence: null }, NOW, NOW)).toBeNull();
    expect(nextDueDate({ dueDate: null, recurrence: { unit: 'day', interval: 1 } }, NOW, NOW)).toBeNull();
  });
});

describe('etiketler', () => {
  test('hazır seçenekler', () => {
    expect(presetKey(null)).toBe('none');
    expect(presetKey(rule({}))).toBe('daily');
    expect(presetKey(rule({ unit: 'week', weekdays: [1, 2, 3, 4, 5] }))).toBe('weekdays');
    expect(presetKey(rule({ unit: 'week' }))).toBe('weekly');
    expect(presetKey(rule({ unit: 'week', weekdays: [5] }))).toBe('custom');
    expect(presetKey(rule({ unit: 'month', interval: 2 }))).toBe('custom');
  });

  test('Türkçe açıklamalar', () => {
    expect(recurrenceLabel(rule({}))).toBe('Her gün');
    expect(recurrenceLabel(rule({ unit: 'week', weekdays: [1, 2, 3, 4, 5] }))).toBe('Hafta içi');
    expect(recurrenceLabel(rule({ interval: 3 }))).toBe('Her 3 günde bir');
    expect(recurrenceLabel(rule({ unit: 'week', interval: 2, weekdays: [3, 1] }))).toBe('Her 2 haftada bir: Pzt, Çar');
    expect(recurrenceLabel(rule({ unit: 'week', weekdays: [0, 5] }))).toBe('Her hafta: Cum, Paz');
    expect(recurrenceLabel(rule({ unit: 'month', interval: 2 }))).toBe('Her 2 ayda bir');
    expect(recurrenceLabel(rule({ unit: 'year', interval: 2 }))).toBe('Her 2 yılda bir');
    expect(recurrenceLabel(rule({ unit: 'month', from: 'completion' }))).toBe('Her ay (tamamlandıktan sonra)');
  });
});
