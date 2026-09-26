import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { priorityColors, useThemedStyles, useTheme } from '../theme';
import { useTodoStore } from '../store/useTodoStore';
import { parseQuickAdd } from '../domain/quickParse';
import { formatDueLabel, toDateKey } from '../domain/dates';
import { showError } from './confirm';
import { strings } from '../strings';

const t = strings.quickAdd;

// Hızlı ekleme satırı. Yazılan satır ayrıştırılır ("yarın 15:00 doktor
// #sağlık @iş !yüksek"); anlaşılan değerler ekranın `defaults` değerlerinin
// (ör. kategori ekranında o kategori) üzerine yazılır. Yazarken altta
// önizleme çipleri görünür. Ayrıntı butonu aynı değerlerle tam formu açar.
export default function QuickAdd({ defaults = {}, placeholder = t.placeholder }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const categories = useTodoStore(s => s.categories);
  const parsed = useMemo(() => parseQuickAdd(text, { categories }), [text, categories]);

  // Ayrıştırılan değerleri varsayılanlarla birleştirir; yeni etiketleri oluşturur.
  async function resolve() {
    const store = useTodoStore.getState();
    const tagIds = [...(defaults.tagIds ?? [])];
    for (const name of parsed.tagNames) {
      const tag = await store.findOrCreateTag(name);
      if (!tagIds.includes(tag.id)) tagIds.push(tag.id);
    }
    const dueDate = parsed.dueDate ?? defaults.dueDate ?? (parsed.dueTime ? toDateKey(new Date()) : null);
    return {
      ...defaults,
      title: parsed.title,
      dueDate,
      dueTime: dueDate ? parsed.dueTime : null,
      priority: parsed.priority ?? defaults.priority ?? 0,
      categoryId: parsed.categoryId ?? defaults.categoryId,
      tagIds,
    };
  }

  async function openForm() {
    try {
      const values = await resolve();
      // URL parametreleri metin olmalı; diziler virgülle birleştirilir, boşlar atlanır.
      const params = Object.fromEntries(
        Object.entries(values)
          .filter(([, v]) => v != null && v !== '')
          .map(([key, v]) => [key, Array.isArray(v) ? v.join(',') : String(v)]),
      );
      router.push({ pathname: '/task/new', params });
      setText('');
    } catch (e) {
      showError(e);
    }
  }

  async function submit() {
    if (!text.trim()) return;
    if (!parsed.title) {
      showError(new Error(t.emptyTitle));
      return;
    }
    try {
      const values = await resolve();
      setText('');
      await useTodoStore.getState().addTask(values);
    } catch (e) {
      showError(e);
    }
  }

  const preview = previewChips(parsed);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          returnKeyType="done"
          blurOnSubmit={false}
          accessibilityLabel={placeholder}
        />
        <TouchableOpacity style={styles.secondary} onPress={openForm} accessibilityLabel={t.details}>
          <Feather name="sliders" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={submit} accessibilityLabel={t.add}>
          <Feather name="plus" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>
      {preview.length > 0 && (
        <View style={styles.preview} accessibilityLabel={t.previewLabel} aria-live="polite">
          {preview.map(chip => (
            <View key={chip.key} style={styles.chip}>
              <Feather name={chip.icon} size={12} color={chip.color ?? colors.primary} />
              <Text style={[styles.chipText, chip.color && { color: chip.color }]}>{chip.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function previewChips(parsed) {
  const chips = [];
  if (parsed.dueDate || parsed.dueTime) {
    const dueDate = parsed.dueDate ?? toDateKey(new Date());
    chips.push({ key: 'date', icon: 'calendar', label: formatDueLabel({ dueDate, dueTime: parsed.dueTime }) });
  }
  if (parsed.categoryId) {
    const category = useTodoStore.getState().categories.find(c => c.id === parsed.categoryId);
    chips.push({ key: 'category', icon: category?.icon ?? 'folder', label: category?.name ?? '', color: category?.color });
  }
  for (const name of parsed.tagNames) chips.push({ key: `tag-${name}`, icon: 'hash', label: name });
  if (parsed.priority) {
    chips.push({
      key: 'priority',
      icon: 'flag',
      label: t.priorityChip(strings.priority.labels[parsed.priority]),
      color: priorityColors[parsed.priority],
    });
  }
  return chips;
}

const makeStyles = colors => StyleSheet.create({
  container: {
    marginBottom: 12,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
});
