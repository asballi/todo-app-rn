import React, { createContext, useContext, useMemo } from 'react';

// Renk setleri. Ekranlar renkleri doğrudan buradan değil, useTheme() /
// useThemedStyles() ile etkin temadan alır.
export const lightColors = {
  background: '#ecebff',
  surface: '#fff',
  primary: '#6c63ff',
  text: '#1a1a2e',
  muted: '#999',
  border: '#e0e0e0',
  danger: '#e05c5c',
  tagDefault: '#8a8a9e',
  // Önemli listesi (Gecikmiş'in kırmızısından ayrışsın; beyaz simgeyle ≥ 3:1)
  important: '#d97706',
  // Renkli zemin (birincil renk, kategori/etiket rengi) üzerindeki simge ve metin
  onPrimary: '#fff',
  placeholder: '#bbb',
  shadow: '#000',
  // Geri alma şeridi gibi zıt renkli yüzeyler
  inverseSurface: '#1a1a2e',
  inverseText: '#fff',
  inversePrimary: '#b8b3ff',
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
export const priorityColors = ['#b0b0b0', '#3b82f6', '#f08c3a', '#e05c5c'];

const LIGHT = { dark: false, colors: lightColors };
const ThemeContext = createContext(LIGHT);

export function ThemeProvider({ children }) {
  return <ThemeContext.Provider value={LIGHT}>{children}</ThemeContext.Provider>;
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
