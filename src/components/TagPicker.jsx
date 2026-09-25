import React, { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import Chip from './Chip';
import { showError } from './confirm';
import { useTodoStore, isAlive } from '../store/useTodoStore';
import { suggestTags } from '../domain/filters';
import { tagKey } from '../domain/tags';
import { colors } from '../theme';

const MAX_SUGGESTIONS = 8;

// Seçili etiketler işaretli çip olarak görünür; yazdıkça eşleşen etiketler
// önerilir. Eşleşme yoksa yazılan adla yeni etiket oluşturulur.
export default function TagPicker({ value, onChange }) {
  const allTags = useTodoStore(s => s.tags);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => value.map(id => allTags.find(t => t.id === id)).filter(t => t && isAlive(t)),
    [value, allTags],
  );
  const suggestions = useMemo(
    () => suggestTags(allTags, query, value).slice(0, MAX_SUGGESTIONS),
    [allTags, query, value],
  );
  const trimmed = query.trim();
  const exactMatch = trimmed && allTags.find(t => isAlive(t) && t.nameKey === tagKey(trimmed));

  function add(tagId) {
    if (!value.includes(tagId)) onChange([...value, tagId]);
    setQuery('');
  }

  async function submit() {
    if (!trimmed) return;
    try {
      const tag = exactMatch ?? (await useTodoStore.getState().findOrCreateTag(trimmed));
      add(tag.id);
    } catch (e) {
      showError(e);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={submit}
        placeholder="Etiket ara veya oluştur"
        placeholderTextColor="#bbb"
        returnKeyType="done"
        blurOnSubmit={false}
        accessibilityLabel="Etiket ara veya oluştur"
      />
      <View style={styles.row}>
        {selected.map(tag => (
          <Chip
            key={tag.id}
            label={`#${tag.name}`}
            selected
            multiple
            color={tag.color ?? colors.tagDefault}
            onPress={() => onChange(value.filter(id => id !== tag.id))}
            accessibilityLabel={`Etiket ${tag.name}`}
          />
        ))}
        {suggestions.map(tag => (
          <Chip
            key={tag.id}
            label={`#${tag.name}`}
            selected={false}
            multiple
            color={tag.color ?? colors.tagDefault}
            onPress={() => add(tag.id)}
            accessibilityLabel={`Etiket ${tag.name}`}
          />
        ))}
        {trimmed && !exactMatch && (
          <Chip label={`"${trimmed}" oluştur`} icon="plus" onPress={submit} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
