import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Stack, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTodoStore, liveRecords, isAlive } from '../src/store/useTodoStore';
import ColorPicker from '../src/components/ColorPicker';
import IconPicker from '../src/components/IconPicker';
import { confirm, showError } from '../src/components/confirm';
import { goBack } from '../src/components/navigation';
import { colors, categoryColors } from '../src/theme';

// Yeni kategori (?id yok) veya mevcut kategoriyi düzenleme (?id=...).
export default function CategoryFormScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  // Açılıştaki hali kullanılır; silme sonrası store güncellenince form
  // "bulunamadı" durumuna düşmez.
  const [category] = useState(() => {
    const found = id && useTodoStore.getState().categories.find(c => c.id === id);
    return found && isAlive(found) ? found : null;
  });

  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? categoryColors[0]);
  const [icon, setIcon] = useState(category?.icon ?? 'folder');

  const isEdit = !!category;
  const canSave = name.trim().length > 0;
  const close = () => goBack(router, '/lists');

  async function save() {
    if (!canSave) return;
    const store = useTodoStore.getState();
    try {
      if (isEdit) await store.updateCategory(id, { name, color, icon });
      else await store.addCategory({ name, color, icon });
      close();
    } catch (e) {
      showError(e);
    }
  }

  async function remove() {
    const taskCount = liveRecords(useTodoStore.getState().tasks).filter(t => t.categoryId === id).length;
    const ok = await confirm({
      title: `"${category.name}" silinsin mi?`,
      message: taskCount > 0 ? `İçindeki ${taskCount} görev Gelen Kutusu'na taşınacak.` : undefined,
      confirmText: 'Sil',
      destructive: true,
    });
    if (!ok) return;
    try {
      await useTodoStore.getState().deleteCategory(id);
      close();
    } catch (e) {
      showError(e);
    }
  }

  if (id && !category) return <Redirect href="/lists" />;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEdit ? 'Kategoriyi düzenle' : 'Yeni kategori' }} />

      <View style={styles.preview}>
        <View style={[styles.previewIcon, { backgroundColor: color }]}>
          <Feather name={icon} size={20} color="#fff" />
        </View>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          onSubmitEditing={save}
          placeholder="Kategori adı"
          placeholderTextColor="#bbb"
          autoFocus={!isEdit}
          returnKeyType="done"
        />
      </View>

      <Text style={styles.label}>Renk</Text>
      <ColorPicker value={color} onChange={setColor} />

      <Text style={styles.label}>Simge</Text>
      <IconPicker value={icon} onChange={setIcon} color={color} />

      <TouchableOpacity
        style={[styles.saveButton, !canSave && styles.disabled]}
        onPress={save}
        disabled={!canSave}
      >
        <Text style={styles.saveText}>{isEdit ? 'Kaydet' : 'Oluştur'}</Text>
      </TouchableOpacity>

      {isEdit && !category.isSystem && (
        <TouchableOpacity style={styles.deleteButton} onPress={remove}>
          <Feather name="trash-2" size={16} color={colors.danger} />
          <Text style={styles.deleteText}>Kategoriyi sil</Text>
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
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
