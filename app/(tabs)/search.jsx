import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTodoStore } from '../../src/store/useTodoStore';
import {
  searchTasks,
  hasSearchCriteria,
  splitCompleted,
  sortCategories,
  sortTags,
} from '../../src/domain/filters';
import Chip from '../../src/components/Chip';
import TaskRows from '../../src/components/TaskRows';
import CompletedSection from '../../src/components/CompletedSection';
import EmptyState from '../../src/components/EmptyState';
import { PRIORITY_LABELS } from '../../src/components/PriorityPicker';
import { colors, priorityColors } from '../../src/theme';
import { strings } from '../../src/strings';

const s = strings.search;
const toggle = (list, value) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

export default function SearchScreen() {
  const tasks = useTodoStore(s => s.tasks);
  const taskTags = useTodoStore(s => s.taskTags);
  const allCategories = useTodoStore(s => s.categories);
  const allTags = useTodoStore(s => s.tags);
  const categories = useMemo(() => sortCategories(allCategories), [allCategories]);
  const tags = useMemo(() => sortTags(allTags), [allTags]);

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [tagIds, setTagIds] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [tagMode, setTagMode] = useState('all'); // 'all' (VE) | 'any' (VEYA)
  const [showFilters, setShowFilters] = useState(false);

  // Silinen kategori/etiket seçili kalırsa filtre sessizce boş sonuç vermesin.
  const liveCategoryId = categories.some(c => c.id === categoryId) ? categoryId : null;
  const liveTagIds = tagIds.filter(id => tags.some(t => t.id === id));
  const criteria = { query, categoryId: liveCategoryId, tagIds: liveTagIds, tagMode, priorities };
  const filterCount = (liveCategoryId ? 1 : 0) + liveTagIds.length + priorities.length;
  const active = hasSearchCriteria(criteria);

  // Kişisel görev listesinde her tuşta aramak ucuzdur; önbelleğe gerek yok.
  const { open, completed } = active
    ? splitCompleted(searchTasks(tasks, taskTags, criteria))
    : { open: [], completed: [] };

  function clearFilters() {
    setCategoryId(null);
    setTagIds([]);
    setTagMode('all');
    setPriorities([]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.searchRow}>
        <Feather name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={s.placeholder}
          placeholderTextColor="#bbb"
          returnKeyType="search"
          accessibilityLabel={s.placeholder}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel={s.clear} hitSlop={8}>
            <Feather name="x" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
          accessibilityRole="button"
          aria-expanded={showFilters}
        >
          <Feather name="filter" size={15} color={colors.primary} />
          <Text style={styles.filterToggleText}>{s.filters(filterCount)}</Text>
          <Feather name={showFilters ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} />
        </TouchableOpacity>
        {filterCount > 0 && (
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearText}>{s.clearFilters}</Text>
          </TouchableOpacity>
        )}
      </View>

      {showFilters && (
        <View style={styles.panel}>
          <Text style={styles.label}>{s.category}</Text>
          <View style={styles.chips}>
            {categories.map(category => (
              <Chip
                key={category.id}
                label={category.name}
                icon={category.icon}
                color={category.color}
                selected={liveCategoryId === category.id}
                onPress={() => setCategoryId(liveCategoryId === category.id ? null : category.id)}
                accessibilityLabel={strings.category.chipLabel(category.name)}
              />
            ))}
          </View>

          <Text style={styles.label}>{s.tags}</Text>
          {tags.length > 1 && (
            <View style={styles.chips}>
              {[['all', s.tagModeAll], ['any', s.tagModeAny]].map(([mode, label]) => (
                <Chip
                  key={mode}
                  label={label}
                  selected={tagMode === mode}
                  onPress={() => setTagMode(mode)}
                  accessibilityLabel={s.tagModeLabel(label)}
                />
              ))}
            </View>
          )}
          <View style={styles.chips}>
            {tags.length === 0 && <Text style={styles.none}>{s.noTags}</Text>}
            {tags.map(tag => (
              <Chip
                key={tag.id}
                label={`#${tag.name}`}
                multiple
                color={tag.color ?? colors.tagDefault}
                selected={liveTagIds.includes(tag.id)}
                onPress={() => setTagIds(toggle(liveTagIds, tag.id))}
                accessibilityLabel={strings.tag.chipLabel(tag.name)}
              />
            ))}
          </View>

          <Text style={styles.label}>{s.priority}</Text>
          <View style={styles.chips}>
            {PRIORITY_LABELS.map((label, priority) => (
              <Chip
                key={label}
                label={label}
                icon="flag"
                multiple
                color={priorityColors[priority]}
                selected={priorities.includes(priority)}
                onPress={() => setPriorities(toggle(priorities, priority))}
                accessibilityLabel={strings.priority.chipLabel(label)}
              />
            ))}
          </View>
        </View>
      )}

      {!active ? (
        <EmptyState icon="search" text={s.hint} />
      ) : open.length + completed.length === 0 ? (
        <EmptyState icon="inbox" color={colors.muted} text={s.noResults} />
      ) : (
        <>
          <Text style={styles.count}>{s.resultCount(open.length + completed.length)}</Text>
          <TaskRows tasks={open} />
          <CompletedSection tasks={completed} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 6,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  filterToggleText: {
    color: colors.primary,
    fontWeight: '600',
  },
  clearText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500',
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  none: {
    color: '#bbb',
    fontSize: 13,
  },
  count: {
    fontSize: 13,
    color: colors.muted,
    marginVertical: 8,
    paddingHorizontal: 4,
  },
});
