import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Chip from './Chip';
import DateInput from './DateInput';
import PriorityPicker from './PriorityPicker';
import CategoryPicker from './CategoryPicker';
import TagPicker from './TagPicker';
import ChecklistEditor from './ChecklistEditor';
import RecurrencePicker from './RecurrencePicker';
import ReminderPicker from './ReminderPicker';
import { strings } from '../strings';
import { quickDueDates } from '../domain/dates';
import { colors } from '../theme';

const DEFAULT_TIME = '09:00';
const f = strings.taskForm;

// Yeni görev ve görev detayı aynı formu kullanır. `children` formun altına
// eklenir (ör. detay ekranındaki tamamla/sil butonları).
export default function TaskForm({ initial, submitLabel, onSubmit, autoFocus, children }) {
  const [title, setTitle] = useState(initial.title);
  const [notes, setNotes] = useState(initial.notes);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [dueTime, setDueTime] = useState(initial.dueTime);
  const [priority, setPriority] = useState(initial.priority);
  const [tagIds, setTagIds] = useState(initial.tagIds ?? []);
  const [checklist, setChecklist] = useState(initial.checklist ?? []);
  const [recurrence, setRecurrence] = useState(initial.recurrence ?? null);
  const [reminders, setReminders] = useState(initial.reminders ?? []);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && !saving;

  function changeDueDate(value) {
    setDueDate(value);
    // Saat ve tekrar bir tarihe bağlıdır.
    if (!value) {
      setDueTime(null);
      setRecurrence(null);
      setReminders([]);
    }
  }

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        title, notes, categoryId, dueDate, dueTime, priority, tagIds, checklist, recurrence, reminders,
      });
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
          placeholder={f.titlePlaceholder}
          placeholderTextColor="#bbb"
          autoFocus={autoFocus}
          accessibilityLabel={f.titlePlaceholder}
        />
        <TextInput
          style={styles.notes}
          value={notes}
          onChangeText={setNotes}
          placeholder={f.notesPlaceholder}
          placeholderTextColor="#bbb"
          multiline
          accessibilityLabel={f.notesLabel}
        />
      </View>

      <Text style={styles.label}>{strings.checklist.title}</Text>
      <ChecklistEditor value={checklist} onChange={setChecklist} />

      <Text style={styles.label}>{f.date}</Text>
      <View style={styles.row}>
        {quickDueDates().map(option => (
          <Chip
            key={option.label}
            label={option.label}
            selected={dueDate === option.value}
            onPress={() => changeDueDate(option.value)}
          />
        ))}
        <Chip label={f.noDate} selected={!dueDate} onPress={() => changeDueDate(null)} accessibilityLabel={f.noDateLabel} />
      </View>
      {dueDate && (
        <View style={styles.row}>
          <DateInput mode="date" value={dueDate} onChange={changeDueDate} />
          {dueTime ? (
            <>
              <DateInput mode="time" value={dueTime} onChange={setDueTime} />
              <Chip label={f.noTime} icon="x" onPress={() => setDueTime(null)} />
            </>
          ) : (
            <Chip label={f.addTime} icon="clock" onPress={() => setDueTime(DEFAULT_TIME)} />
          )}
        </View>
      )}

      {dueDate && (
        <>
          <Text style={styles.label}>{strings.recurrence.title}</Text>
          <RecurrencePicker value={recurrence} dueDate={dueDate} onChange={setRecurrence} />

          <Text style={styles.label}>{strings.reminders.title}</Text>
          <ReminderPicker value={reminders} dueTime={dueTime} onChange={setReminders} />
        </>
      )}

      <Text style={styles.label}>{f.category}</Text>
      <CategoryPicker value={categoryId} onChange={setCategoryId} />

      <Text style={styles.label}>{f.tags}</Text>
      <TagPicker value={tagIds} onChange={setTagIds} />

      <Text style={styles.label}>{f.priority}</Text>
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
