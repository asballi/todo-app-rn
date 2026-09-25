import React from 'react';
import { Platform, TouchableOpacity, Text, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { parseDateKey, toDateKey, toTimeString } from '../domain/dates';
import { colors } from '../theme';

// Mobil tarih/saat seçici. value: "YYYY-MM-DD" (mode="date") veya "HH:mm"
// (mode="time"). Web sürümü DateInput.web.jsx içindedir.
export default function DateInput({ mode, value, onChange }) {
  const date = mode === 'date' ? parseDateKey(value) : parseDateKey('2000-01-01', value);

  function handleChange(event, selected) {
    if (event.type !== 'set' || !selected) return;
    onChange(mode === 'date' ? toDateKey(selected) : toTimeString(selected));
  }

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={date}
        mode={mode}
        display="compact"
        locale="tr-TR"
        onChange={handleChange}
      />
    );
  }

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => DateTimePickerAndroid.open({ value: date, mode, is24Hour: true, onChange: handleChange })}
    >
      <Text style={styles.text}>{value}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  text: {
    fontSize: 14,
    color: colors.text,
  },
});
