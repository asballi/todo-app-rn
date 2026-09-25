import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';

// Renk setleri. Ekranlar renkleri doğrudan buradan değil, useTheme() /
// useThemedStyles() ile etkin temadan alır. Metin renkleri WCAG AA (≥ 4,5:1)
// kontrastını sağlar; bu, src/__tests__/theme.test.js ile doğrulanır.
export const lightColors = {
  background: '#ecebff',
  surface: '#ffffff',
  primary: '#5b52ee',
  text: '#1a1a2e',
  muted: '#66667a',
  border: '#e0e0e0',
  danger: '#c53030',
  tagDefault: '#6e6e82',
  // Önemli listesi (Gecikmiş'in kırmızısından ayrışsın)
  important: '#d97706',
  // Birincil renk üzerindeki metin ve simgeler
  onPrimary: '#ffffff',
  placeholder: '#737383',
  shadow: '#000000',
  // Geri alma şeridi gibi zıt renkli yüzeyler
  inverseSurface: '#1a1a2e',
  inverseText: '#ffffff',
  inversePrimary: '#b8b3ff',
};

export const darkColors = {
  background: '#121218',
  surface: '#1e1e2a',
  primary: '#9d97ff',
  text: '#ececf5',
  muted: '#a3a3b8',
  border: '#34344a',
  danger: '#ff8a8a',
  tagDefault: '#a3a3b8',
  important: '#d97706',
  // Açık lavanta birincil renk üzerinde koyu metin
  onPrimary: '#15132b',
  placeholder: '#8f8fa3',
  shadow: '#000000',
  inverseSurface: '#e8e7f5',
  inverseText: '#1a1a2e',
  inversePrimary: '#4f46e5',
};

// Kullanıcının seçtiği kategori, etiket ve öncelik renkleri iki temada da aynıdır.
export const categoryColors = [
  '#6c63ff', '#3b82f6', '#20a4a4', '#3cb371', '#e6b422',
  '#f08c3a', '#e05c5c', '#ec4899', '#a855f7', '#64748b',
];

export const categoryIcons = [
  'folder', 'inbox', 'briefcase', 'home', 'shopping-cart', 'heart', 'book', 'star',
  'coffee', 'gift', 'music', 'film', 'map-pin', 'dollar-sign', 'activity', 'code',
  'phone', 'users', 'sun', 'flag',
];

// Öncelik, checkbox kenar rengiyle gösterilir: 0 yok … 3 yüksek.
// Kenar rengi olarak iki temanın yüzeyinde de ≥ 3:1 kontrast sağlar.
export const priorityColors = ['#8e8e9a', '#3b82f6', '#d9731f', '#e05c5c'];

// --- Kontrast (WCAG 2.x) ---
function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const ON_COLOR_LIGHT = '#ffffff';
const ON_COLOR_DARK = '#15132b';

// Kullanıcının seçtiği renkli zemin (kategori, etiket, öncelik) üzerindeki
// simge/metin: beyaz ve koyudan hangisi daha okunaklıysa o.
export function onColor(background) {
  return contrastRatio(ON_COLOR_LIGHT, background) >= contrastRatio(ON_COLOR_DARK, background)
    ? ON_COLOR_LIGHT
    : ON_COLOR_DARK;
}

// --- Tema bağlamı ---
const THEMES = {
  light: { dark: false, colors: lightColors },
  dark: { dark: true, colors: darkColors },
};
const ThemeContext = createContext(THEMES.light);

// mode: 'system' (cihaz/tarayıcı tercihi) | 'light' | 'dark'
export function ThemeProvider({ mode = 'system', children }) {
  const scheme = useColorScheme();
  const theme = THEMES[mode === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : mode] ?? THEMES.light;

  // Web'de sayfa zemini ve tarayıcı denetimleri (tarih alanı, kaydırma çubuğu) temaya uysun.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.colorScheme = theme.dark ? 'dark' : 'light';
    document.body.style.backgroundColor = theme.colors.background;
  }, [theme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

// { dark, colors }
export function useTheme() {
  return useContext(ThemeContext);
}

// Stil fabrikası (colors => StyleSheet.create({...})) etkin temaya göre
// bir kez oluşturulur; fabrika modül düzeyinde tanımlanmalıdır.
export function useThemedStyles(makeStyles) {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [makeStyles, colors]);
}
