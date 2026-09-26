import { lightColors, darkColors, contrastRatio, onColor, categoryColors, priorityColors } from '../theme';

// WCAG AA: metin ≥ 4,5:1, simge ve arayüz bileşeni sınırları ≥ 3:1.
const TEXT = 4.5;
const NON_TEXT = 3;

describe.each([
  ['açık', lightColors],
  ['koyu', darkColors],
])('%s tema', (_, c) => {
  test.each([
    ['text', 'background'],
    ['text', 'surface'],
    ['muted', 'background'],
    ['muted', 'surface'],
    ['primary', 'background'],
    ['primary', 'surface'],
    ['danger', 'background'],
    ['danger', 'surface'],
    ['tagDefault', 'surface'],
    ['placeholder', 'surface'],
    ['onPrimary', 'primary'],
    ['inverseText', 'inverseSurface'],
    ['inversePrimary', 'inverseSurface'],
  ])('metin: %s / %s ≥ 4,5', (fg, bg) => {
    expect(contrastRatio(c[fg], c[bg])).toBeGreaterThanOrEqual(TEXT);
  });

  test('öncelik halkaları yüzeyde ≥ 3:1', () => {
    for (const color of priorityColors) {
      expect(contrastRatio(color, c.surface)).toBeGreaterThanOrEqual(NON_TEXT);
    }
  });

  test('akıllı liste rozetlerinde simge ≥ 3:1', () => {
    for (const bg of [c.danger, c.important, c.tagDefault]) {
      expect(contrastRatio(onColor(bg), bg)).toBeGreaterThanOrEqual(NON_TEXT);
    }
  });
});

test('kategori renkleri üzerindeki simge (onColor) ≥ 3:1', () => {
  for (const bg of [...categoryColors, ...priorityColors]) {
    expect(contrastRatio(onColor(bg), bg)).toBeGreaterThanOrEqual(NON_TEXT);
  }
});

test('onColor açık zeminde koyu, koyu zeminde beyaz seçer', () => {
  expect(onColor('#e6b422')).toBe('#15132b');
  expect(onColor('#1a1a2e')).toBe('#ffffff');
});

test('contrastRatio bilinen değerler', () => {
  expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
});
