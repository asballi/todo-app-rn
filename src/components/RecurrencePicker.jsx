import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Chip from './Chip';
import {
  PRESETS,
  UNITS,
  WEEKDAY_ORDER,
  WEEKDAYS_SHORT,
  presetKey,
  recurrenceLabel,
  normalizeRecurrence,
} from '../domain/recurrence';
import { strings } from '../strings';
import { useThemedStyles, useTheme } from '../theme';

const t = strings.recurrence;
const EMPTY_CUSTOM = { unit: 'day', interval: 1, weekdays: null, from: 'due', monthDay: null };

// Tekrar seçici: hazır seçenekler, "Özel" ile her N gün/hafta/ay/yıl ve
// haftalıkta gün seçimi; sayma başlangıcı (bitiş / tamamlanma).
export default function RecurrencePicker({ value, dueDate, onChange }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const current = presetKey(value);
  const [customOpen, setCustomOpen] = useState(current === 'custom');
  const showCustom = customOpen || current === 'custom';

  // Birim değişince aylık/yıllık serinin günü yeni tarihten hesaplansın.
  const change = rule =>
    onChange({ ...rule, monthDay: value && rule.unit === value.unit ? value.monthDay : null });

  function pickPreset(preset) {
    setCustomOpen(false);
    change({ ...preset.rule, from: value?.from ?? 'due' });
  }

  function pickCustom() {
    setCustomOpen(true);
    if (!value) change(EMPTY_CUSTOM);
  }

  function toggleWeekday(day) {
    const days = value.weekdays ?? [];
    const next = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
    change({ ...value, weekdays: next.length ? next : null });
  }

  let label = null;
  try {
    label = recurrenceLabel(normalizeRecurrence(value, dueDate));
  } catch {
    label = null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Chip
          label={t.none}
          selected={!value}
          onPress={() => {
            setCustomOpen(false);
            onChange(null);
          }}
        />
        {PRESETS.map(preset => (
          <Chip
            key={preset.key}
            label={preset.label}
            icon="repeat"
            selected={!showCustom && current === preset.key}
            onPress={() => pickPreset(preset)}
          />
        ))}
        <Chip label={t.custom} icon="sliders" selected={showCustom && !!value} onPress={pickCustom} />
      </View>

      {showCustom && value && (
        <View style={styles.panel}>
          <View style={styles.row}>
            <Text style={styles.text}>{t.every}</Text>
            <TouchableOpacity
              style={styles.stepper}
              onPress={() => change({ ...value, interval: Math.max(1, value.interval - 1) })}
              accessibilityLabel={t.decrease}
            >
              <Feather name="minus" size={14} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.interval} accessibilityLabel={t.intervalLabel(value.interval)}>
              {value.interval}
            </Text>
            <TouchableOpacity
              style={styles.stepper}
              onPress={() => change({ ...value, interval: Math.min(365, value.interval + 1) })}
              accessibilityLabel={t.increase}
            >
              <Feather name="plus" size={14} color={colors.primary} />
            </TouchableOpacity>
            {UNITS.map(unit => (
              <Chip
                key={unit}
                label={t.units[unit]}
                selected={value.unit === unit}
                onPress={() => change({ ...value, unit, weekdays: unit === 'week' ? value.weekdays : null })}
              />
            ))}
          </View>
          {value.unit === 'week' && (
            <View style={styles.row}>
              {WEEKDAY_ORDER.map(day => (
                <Chip
                  key={day}
                  label={WEEKDAYS_SHORT[day]}
                  multiple
                  selected={(value.weekdays ?? []).includes(day)}
                  onPress={() => toggleWeekday(day)}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {value && (
        <View style={styles.row}>
          <Chip label={t.fromDue} selected={value.from !== 'completion'} onPress={() => change({ ...value, from: 'due' })} />
          <Chip
            label={t.fromCompletion}
            selected={value.from === 'completion'}
            onPress={() => change({ ...value, from: 'completion' })}
          />
        </View>
      )}

      {label && <Text style={styles.summary}>{t.repeats(label)}</Text>}
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  text: {
    fontSize: 14,
    color: colors.text,
  },
  stepper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interval: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  summary: {
    fontSize: 13,
    color: colors.muted,
    paddingHorizontal: 4,
  },
});
