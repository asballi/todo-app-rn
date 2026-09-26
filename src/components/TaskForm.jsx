import React, { useEffect, useRef, useState } from 'react';
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
import { useThemedStyles, useTheme } from '../theme';
import { showError } from './confirm';

const DEFAULT_TIME = '09:00';
const TEXT_SAVE_DELAY = 500;
const f = strings.taskForm;

// Yeni görev ve görev detayı aynı formu kullanır.
// - onSubmit + submitLabel: "Oluştur" butonlu form (yeni görev).
// - autoSave: butonsuz, her değişiklik kendiliğinden kaydedilir (görev detayı).
//   Seçimler hemen, yazılan metinler 0,5 sn sonra, ekrandan çıkarken bekleyen
//   değişiklik hemen kaydedilir. Boş başlık kaydedilmez; son geçerli başlık korunur.
// `children` formun altına eklenir; fonksiyonsa { flush } alır (bekleyen
// kaydı hemen yapmak için, ör. tamamla/sil butonlarından önce).
export default function TaskForm({ initial, submitLabel, onSubmit, autoSave, autoFocus, children }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
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
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'

  const canSave = title.trim().length > 0 && !saving;
  const titleMissing = !!autoSave && !title.trim();
  const values = { title, notes, categoryId, dueDate, dueTime, priority, tagIds, checklist, recurrence, reminders };
  const valuesKey = JSON.stringify(values);

  // --- Otomatik kaydetme ---
  const latest = useRef(values);
  latest.current = values;
  const lastValidTitle = useRef(initial.title);
  if (title.trim()) lastValidTitle.current = title;
  const lastSavedKey = useRef(valuesKey);
  const nextDelay = useRef(0);
  const timer = useRef(null);

  // Metin alanları gecikmeli, diğer her şey hemen kaydedilir.
  const typed = setter => value => {
    nextDelay.current = TEXT_SAVE_DELAY;
    setter(value);
  };
  const picked = setter => value => {
    nextDelay.current = 0;
    setter(value);
  };

  async function flush() {
    clearTimeout(timer.current);
    timer.current = null;
    if (!autoSave) return;
    const current = latest.current;
    const toSave = { ...current, title: current.title.trim() ? current.title : lastValidTitle.current };
    const key = JSON.stringify(toSave);
    if (key === lastSavedKey.current) return;
    lastSavedKey.current = key;
    setSaveStatus('saving');
    try {
      await autoSave(toSave);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus(null);
      lastSavedKey.current = null;
      showError(e);
    }
  }
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Yalnızca form değerleri değişince zamanlanır (autoSave her render'da yeni
  // bir fonksiyon olabilir; en güncelini flushRef üzerinden kullanırız).
  useEffect(() => {
    if (!autoSave) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), nextDelay.current);
  }, [valuesKey]);

  // Ekrandan çıkarken bekleyen değişikliği kaydet.
  useEffect(() => () => {
    if (timer.current) flushRef.current();
  }, []);

  function changeDueDate(value) {
    nextDelay.current = 0;
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
      {autoSave && (
        <Text style={styles.status} accessibilityLiveRegion="polite" aria-live="polite">
          {saveStatus === 'saving' ? f.saving : saveStatus === 'saved' ? f.saved : ' '}
        </Text>
      )}
      <View style={styles.card}>
        <TextInput
          style={styles.title}
          value={title}
          onChangeText={typed(setTitle)}
          placeholder={f.titlePlaceholder}
          placeholderTextColor={colors.placeholder}
          autoFocus={autoFocus}
          accessibilityLabel={f.titlePlaceholder}
        />
        <TextInput
          style={styles.notes}
          value={notes}
          onChangeText={typed(setNotes)}
          placeholder={f.notesPlaceholder}
          placeholderTextColor={colors.placeholder}
          multiline
          accessibilityLabel={f.notesLabel}
        />
      </View>
      {titleMissing && (
        <Text style={styles.error}>{strings.errors.required(strings.errors.fields.taskTitle)}</Text>
      )}

      <Text style={styles.label}>{strings.checklist.title}</Text>
      <ChecklistEditor
        value={checklist}
        onChange={(next, { typing } = {}) => (typing ? typed : picked)(setChecklist)(next)}
      />

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
              <DateInput mode="time" value={dueTime} onChange={picked(setDueTime)} />
              <Chip label={f.noTime} icon="x" onPress={() => picked(setDueTime)(null)} />
            </>
          ) : (
            <Chip label={f.addTime} icon="clock" onPress={() => picked(setDueTime)(DEFAULT_TIME)} />
          )}
        </View>
      )}

      {dueDate && (
        <>
          <Text style={styles.label}>{strings.recurrence.title}</Text>
          <RecurrencePicker value={recurrence} dueDate={dueDate} onChange={picked(setRecurrence)} />

          <Text style={styles.label}>{strings.reminders.title}</Text>
          <ReminderPicker value={reminders} dueTime={dueTime} onChange={picked(setReminders)} />
        </>
      )}

      <Text style={styles.label}>{f.category}</Text>
      <CategoryPicker value={categoryId} onChange={picked(setCategoryId)} />

      <Text style={styles.label}>{f.tags}</Text>
      <TagPicker value={tagIds} onChange={picked(setTagIds)} />

      <Text style={styles.label}>{f.priority}</Text>
      <PriorityPicker value={priority} onChange={picked(setPriority)} />

      {!autoSave && (
        <TouchableOpacity
          style={[styles.submit, !canSave && styles.disabled]}
          onPress={submit}
          disabled={!canSave}
        >
          <Text style={styles.submitText}>{submitLabel}</Text>
        </TouchableOpacity>
      )}

      {typeof children === 'function' ? children({ flush }) : children}
    </ScrollView>
  );
}

const makeStyles = colors => StyleSheet.create({
  status: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: colors.muted,
    marginBottom: -4,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    paddingHorizontal: 4,
  },
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
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
