import React from 'react';
import { colors } from '../theme';

// Web: tarayıcının kendi <input type="date|time"> alanı. Değer biçimleri
// uygulamanınkiyle aynıdır ("YYYY-MM-DD", "HH:mm").
export default function DateInput({ mode, value, onChange }) {
  return (
    <input
      type={mode}
      value={value ?? ''}
      aria-label={mode === 'date' ? 'Tarih' : 'Saat'}
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
