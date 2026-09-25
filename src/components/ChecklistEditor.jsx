import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createChecklistItem } from '../domain/models';
import { strings } from '../strings';
import { colors } from '../theme';

const t = strings.checklist;

// Görev formundaki kontrol listesi: işaretle, metni düzenle, sil, Enter ile ekle.
// Boş bırakılan maddeler kaydederken atılır.
export default function ChecklistEditor({ value, onChange }) {
  const [draft, setDraft] = useState('');

  const update = (id, changes) => onChange(value.map(item => (item.id === id ? { ...item, ...changes } : item)));

  function add() {
    if (!draft.trim()) return;
    onChange([...value, createChecklistItem(draft)]);
    setDraft('');
  }

  return (
    <View style={styles.card}>
      {value.map(item => (
        <View key={item.id} style={styles.row}>
          <TouchableOpacity
            onPress={() => update(item.id, { done: !item.done })}
            accessibilityRole="checkbox"
            aria-checked={item.done}
            accessibilityLabel={t.itemLabel(item.title)}
            hitSlop={8}
          >
            <View style={[styles.box, item.done && styles.boxDone]}>
              {item.done && <Feather name="check" size={12} color="#fff" />}
            </View>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, item.done && styles.inputDone]}
            value={item.title}
            onChangeText={title => update(item.id, { title })}
            accessibilityLabel={t.itemLabel(item.title)}
          />
          <TouchableOpacity
            onPress={() => onChange(value.filter(i => i.id !== item.id))}
            accessibilityLabel={t.deleteItem(item.title)}
            hitSlop={8}
          >
            <Feather name="x" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>
      ))}
      <View style={styles.row}>
        <Feather name="plus" size={16} color={colors.primary} style={styles.plus} />
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={t.addPlaceholder}
          placeholderTextColor="#bbb"
          returnKeyType="done"
          blurOnSubmit={false}
          accessibilityLabel={t.addPlaceholder}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: {
    backgroundColor: colors.primary,
  },
  plus: {
    width: 18,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 6,
  },
  inputDone: {
    textDecorationLine: 'line-through',
    color: colors.muted,
  },
});
