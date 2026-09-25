import React from 'react';
import { useTheme } from '../theme';
import { strings } from '../strings';

// Web: tarayıcının kendi <input type="date|time"> alanı. Değer biçimleri
// uygulamanınkiyle aynıdır ("YYYY-MM-DD", "HH:mm").
export default function DateInput({ mode, value, onChange }) {
  const { colors } = useTheme();
  return (
    <input
      type={mode}
      value={value ?? ''}
      aria-label={mode === 'date' ? strings.dates.dateInput : strings.dates.timeInput}
      onChange={e => e.target.value && onChange(e.target.value)}
      style={{
        fontFamily: 'inherit',
        fontSize: 14,
        color: colors.text,
        padding: '6px 10px',
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        background: colors.surface,
      }}
    />
  );
}
