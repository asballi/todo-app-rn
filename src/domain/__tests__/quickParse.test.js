import { parseQuickAdd } from '../quickParse';

// Cuma 25 Eylül 2026, 10:00
const NOW = new Date(2026, 8, 25, 10, 0);
const categories = [
  { id: 'inbox', name: 'Gelen Kutusu', deletedAt: null },
  { id: 'work', name: 'İş', deletedAt: null },
  { id: 'proj', name: 'İş Projeleri', deletedAt: null },
  { id: 'old', name: 'Eski', deletedAt: 'x' },
];
const parse = text => parseQuickAdd(text, { now: NOW, categories });

test('tam örnek', () => {
  expect(parse('yarın 15:00 doktor #sağlık !yüksek')).toEqual({
    title: 'doktor',
    dueDate: '2026-09-26',
    dueTime: '15:00',
    priority: 3,
    categoryId: null,
    tagNames: ['sağlık'],
  });
});

test('düz metin olduğu gibi kalır', () => {
  expect(parse('  Süt   al  ')).toMatchObject({ title: 'Süt al', dueDate: null, dueTime: null, priority: null, tagNames: [] });
});

describe('tarih', () => {
  test.each([
    ['bugün', '2026-09-25'],
    ['Bugun', '2026-09-25'],
    ['yarın', '2026-09-26'],
    ['YARIN', '2026-09-26'],
    ['öbür gün', '2026-09-27'],
    ['obur gun', '2026-09-27'],
    ['öbürgün', '2026-09-27'],
    ['haftaya', '2026-10-02'],
  ])('%s', (word, date) => {
    expect(parse(`fatura öde ${word}`)).toMatchObject({ title: 'fatura öde', dueDate: date });
  });

  test('gün adı bugünden sonraki ilk o gün; bugün aynı günse gelecek hafta', () => {
    expect(parse('pazartesi toplantı').dueDate).toBe('2026-09-28');
    expect(parse('cumartesi').dueDate).toBe('2026-09-26');
    expect(parse('pazar').dueDate).toBe('2026-09-27');
    expect(parse('cuma').dueDate).toBe('2026-10-02');
    expect(parse('Çarşamba').dueDate).toBe('2026-09-30');
    expect(parse('carsamba').dueDate).toBe('2026-09-30');
  });

  test('gün ve ay; geçmişse gelecek yıl; yıl yazılabilir', () => {
    expect(parse('5 ekim sunum')).toMatchObject({ title: 'sunum', dueDate: '2026-10-05' });
    expect(parse('5 Eki sunum').dueDate).toBe('2026-10-05');
    expect(parse('1 ocak').dueDate).toBe('2027-01-01');
    expect(parse('25 eylül').dueDate).toBe('2026-09-25');
    expect(parse('3 mart 2028 vize').dueDate).toBe('2028-03-03');
  });

  test('geçersiz gün başlıkta kalır; artık yıl değilse 29 Şubat da başlıkta kalır', () => {
    expect(parse('31 şubat')).toMatchObject({ title: '31 şubat', dueDate: null });
    expect(parse('29 şubat').dueDate).toBeNull(); // 2027 artık yıl değil
    expect(parse('29 şubat 2028').dueDate).toBe('2028-02-29');
  });

  test('yalnızca ilk tarih kullanılır', () => {
    expect(parse('yarın ve pazartesi')).toMatchObject({ dueDate: '2026-09-26', title: 've pazartesi' });
  });

  test('noktalama eşleşmeyi bozmaz', () => {
    expect(parse('rapor yarın, acil')).toMatchObject({ dueDate: '2026-09-26', title: 'rapor acil' });
  });

  test('sayı ama ay değil: başlıkta kalır', () => {
    expect(parse('5 kilo elma')).toMatchObject({ title: '5 kilo elma', dueDate: null });
  });
});

describe('saat', () => {
  test.each([
    ['15:00', '15:00'],
    ['9:05', '09:05'],
    ['15.30', '15:30'],
    ['saat 15', '15:00'],
    ['saat 9', '09:00'],
    ['Saat 9:30', '09:30'],
  ])('%s', (expr, time) => {
    expect(parse(`ara ${expr}`)).toMatchObject({ title: 'ara', dueTime: time });
  });

  test('geçersiz saat başlıkta kalır', () => {
    expect(parse('24:00 x')).toMatchObject({ title: '24:00 x', dueTime: null });
    expect(parse('saat kulesi')).toMatchObject({ title: 'saat kulesi', dueTime: null });
  });

  test('saat tarihsiz kalır (bugüne atamayı hızlı ekleme yapar)', () => {
    expect(parse('saat 15 ara')).toMatchObject({ dueDate: null, dueTime: '15:00' });
  });
});

describe('işaretler', () => {
  test('etiketler: birden çok, tekrar edilmez, yazıldığı gibi', () => {
    expect(parse('x #İş #acil #iş #ACİL').tagNames).toEqual(['İş', 'acil']);
  });

  test('tek başına # veya ## etiket değildir', () => {
    expect(parse('madde # 3 ##').tagNames).toEqual([]);
    expect(parse('madde # 3 ##').title).toBe('madde # 3 ##');
  });

  test('öncelik: sayı ve kelime', () => {
    expect(parse('x !1').priority).toBe(1);
    expect(parse('x !3').priority).toBe(3);
    expect(parse('x !orta').priority).toBe(2);
    expect(parse('x !YÜKSEK').priority).toBe(3);
    expect(parse('x !yuksek').priority).toBe(3);
    expect(parse('x !5')).toMatchObject({ priority: null, title: 'x !5' });
    expect(parse('dikkat!')).toMatchObject({ priority: null, title: 'dikkat!' });
  });

  test('kategori: var olanla eşleşir, harf/aksan duyarsız, boşluksuz yazılabilir', () => {
    expect(parse('x @iş').categoryId).toBe('work');
    expect(parse('x @IS').categoryId).toBe('work');
    expect(parse('x @isprojeleri').categoryId).toBe('proj');
    expect(parse('x @gelenkutusu').categoryId).toBe('inbox');
  });

  test('bilinmeyen ya da silinmiş kategori başlıkta kalır', () => {
    expect(parse('x @yok')).toMatchObject({ categoryId: null, title: 'x @yok' });
    expect(parse('x @eski')).toMatchObject({ categoryId: null, title: 'x @eski' });
  });
});

test('yalnızca ifadelerden oluşan satırda başlık boş kalır', () => {
  expect(parse('yarın #acil !1').title).toBe('');
});
