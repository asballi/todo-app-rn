import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme';
import { useTodoStore } from '../store/useTodoStore';
import { showError } from './confirm';

// Yalnızca başlıkla görev ekler; kategori, tarih vb. bulunduğu ekrandan
// gelen `defaults` ile doldurulur (ör. kategori ekranında o kategori).
// Ayrıntı butonu aynı varsayılanlarla ve yazılan başlıkla tam formu açar.
export default function QuickAdd({ defaults = {}, placeholder = 'Görev ekle...' }) {
  const router = useRouter();
  const [title, setTitle] = useState('');

  function openForm() {
    router.push({ pathname: '/task/new', params: { ...defaults, title: title.trim() } });
    setTitle('');
  }

  function submit() {
    const text = title.trim();
    if (!text) return;
    setTitle('');
    useTodoStore.getState().addTask({ ...defaults, title: text }).catch(showError);
  }

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
        returnKeyType="done"
        blurOnSubmit={false}
      />
      <TouchableOpacity style={styles.secondary} onPress={openForm} accessibilityLabel="Ayrıntılı görev ekle">
        <Feather name="sliders" size={18} color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={submit} accessibilityLabel="Görev ekle">
        <Feather name="plus" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
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
});
