import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Chip from './Chip';
import DateInput from './DateInput';
import PriorityPicker from './PriorityPicker';
import CategoryPicker from './CategoryPicker';
import { quickDueDates } from '../domain/dates';
import { colors } from '../theme';

const DEFAULT_TIME = '09:00';

// Yeni görev ve görev detayı aynı formu kullanır. `children` formun altına
// eklenir (ör. detay ekranındaki tamamla/sil butonları).
export default function TaskForm({ initial, submitLabel, onSubmit, autoFocus, children }) {
  const [title, setTitle] = useState(initial.title);
  const [notes, setNotes] = useState(initial.notes);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [dueTime, setDueTime] = useState(initial.dueTime);
  const [priority, setPriority] = useState(initial.priority);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && !saving;

  function changeDueDate(value) {
    setDueDate(value);
    if (!value) setDueTime(null);
  }

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({ title, notes, categoryId, dueDate, dueTime, priority });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <TextInput
          style={styles.title}
          value={title}
          onChangeText={setTitle}
          placeholder="Görev başlığı"
          placeholderTextColor="#bbb"
          autoFocus={autoFocus}
          accessibilityLabel="Görev başlığı"
        />
        <TextInput
          style={styles.notes}
          value={notes}
          onChangeText={setNotes}
          placeholder="Not ekle"
          placeholderTextColor="#bbb"
          multiline
          accessibilityLabel="Not"
        />
      </View>

      <Text style={styles.label}>Tarih</Text>
      <View style={styles.row}>
        {quickDueDates().map(option => (
          <Chip
            key={option.label}
            label={option.label}
            selected={dueDate === option.value}
            onPress={() => changeDueDate(option.value)}
          />
        ))}
        <Chip label="Yok" selected={!dueDate} onPress={() => changeDueDate(null)} accessibilityLabel="Tarih yok" />
      </View>
      {dueDate && (
        <View style={styles.row}>
          <DateInput mode="date" value={dueDate} onChange={changeDueDate} />
          {dueTime ? (
            <>
              <DateInput mode="time" value={dueTime} onChange={setDueTime} />
              <Chip label="Saat yok" icon="x" onPress={() => setDueTime(null)} />
            </>
          ) : (
            <Chip label="Saat ekle" icon="clock" onPress={() => setDueTime(DEFAULT_TIME)} />
          )}
        </View>
      )}

      <Text style={styles.label}>Kategori</Text>
      <CategoryPicker value={categoryId} onChange={setCategoryId} />

      <Text style={styles.label}>Öncelik</Text>
      <PriorityPicker value={priority} onChange={setPriority} />

      <TouchableOpacity
        style={[styles.submit, !canSave && styles.disabled]}
        onPress={submit}
        disabled={!canSave}
      >
        <Text style={styles.submitText}>{submitLabel}</Text>
      </TouchableOpacity>

      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 4,
  },
  notes: {
    fontSize: 14,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  disabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
