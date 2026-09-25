import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Stack, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTodoStore, liveRecords, isAlive } from '../src/store/useTodoStore';
import ColorPicker from '../src/components/ColorPicker';
import { confirm, showError } from '../src/components/confirm';
import { goBack } from '../src/components/navigation';
import { colors } from '../src/theme';
import { strings } from '../src/strings';

const t = strings.tag;

// Yeni etiket (?id yok) veya mevcut etiketi düzenleme (?id=...).
export default function TagFormScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // Açılıştaki hali kullanılır; silme sonrası form "bulunamadı" durumuna düşmez.
  const [tag] = useState(() => {
    const found = id && useTodoStore.getState().tags.find(t => t.id === id);
    return found && isAlive(found) ? found : null;
  });

  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState(tag?.color ?? null);

  const isEdit = !!tag;
  const canSave = name.trim().length > 0;
  const close = () => goBack(router, '/lists');

  async function save() {
    if (!canSave) return;
    const store = useTodoStore.getState();
    try {
      if (isEdit) await store.updateTag(id, { name, color });
      else await store.addTag({ name, color });
      close();
    } catch (e) {
      showError(e);
    }
  }

  async function remove() {
    const taskCount = liveRecords(useTodoStore.getState().taskTags).filter(l => l.tagId === id).length;
    const ok = await confirm({
      title: t.deleteConfirm(tag.name),
      message: taskCount > 0 ? t.deleteUnlinks(taskCount) : undefined,
      confirmText: strings.common.delete,
      destructive: true,
    });
    if (!ok) return;
    try {
      await useTodoStore.getState().deleteTag(id);
      close();
    } catch (e) {
      showError(e);
    }
  }

  if (id && !tag) return <Redirect href="/lists" />;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEdit ? t.edit : t.new }} />

      <View style={styles.preview}>
        <Text style={[styles.hash, { color: color ?? colors.tagDefault }]}>#</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          onSubmitEditing={save}
          placeholder={t.namePlaceholder}
          placeholderTextColor="#bbb"
          autoFocus={!isEdit}
          returnKeyType="done"
        />
      </View>

      <Text style={styles.label}>{t.color}</Text>
      <ColorPicker value={color} onChange={setColor} allowNone />

      <TouchableOpacity
        style={[styles.saveButton, !canSave && styles.disabled]}
        onPress={save}
        disabled={!canSave}
      >
        <Text style={styles.saveText}>{isEdit ? strings.common.save : strings.common.create}</Text>
      </TouchableOpacity>

      {isEdit && (
        <TouchableOpacity style={styles.deleteButton} onPress={remove}>
          <Feather name="trash-2" size={16} color={colors.danger} />
          <Text style={styles.deleteText}>{t.delete}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 12,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  hash: {
    fontSize: 22,
    fontWeight: '700',
  },
  nameInput: {
    flex: 1,
    fontSize: 17,
    color: colors.text,
    paddingVertical: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  disabled: {
    opacity: 0.4,
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  deleteText: {
    color: colors.danger,
    fontWeight: '600',
  },
});
