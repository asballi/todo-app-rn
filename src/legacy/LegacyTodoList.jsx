import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme';
import { useTodoStore, liveRecords } from '../store/useTodoStore';
import { sortTasks } from '../domain/sorting';

// Geçici: v1 planının 4. ve 6. adımlarında yeni görev ekranlarıyla değiştirilecek.

const FILTERS = ['Tümü', 'Aktif', 'Tamamlanan'];

// Store işlemleri iyimser güncellenir; kaydetme hatası store.error'a da yazılır.
const report = promise => promise.catch(e => console.warn(e.message));

export default function LegacyTodoList() {
  const allTasks = useTodoStore(s => s.tasks);
  const { addTask, toggleTask, deleteTasks, updateTask } = useTodoStore.getState();
  const todos = useMemo(() => sortTasks(liveRecords(allTasks)), [allTasks]);

  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState('Tümü');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  function addTodo() {
    const title = inputText.trim();
    if (!title) return;
    report(addTask({ title }));
    setInputText('');
  }

  function toggleDone(id) {
    report(toggleTask(id));
  }

  function deleteTodo(id) {
    report(deleteTasks([id]));
  }

  function startEdit(id, text) {
    setEditingId(id);
    setEditingText(text);
  }

  function saveEdit() {
    const title = editingText.trim();
    if (!title) return;
    report(updateTask(editingId, { title }));
    setEditingId(null);
    setEditingText('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText('');
  }

  function clearDone() {
    report(deleteTasks(todos.filter(t => t.completedAt).map(t => t.id)));
  }

  const visibleTodos = todos.filter(t => {
    if (filter === 'Aktif') return !t.completedAt;
    if (filter === 'Tamamlanan') return !!t.completedAt;
    return true;
  });

  const remaining = todos.filter(t => !t.completedAt).length;

  function renderItem({ item }) {
    const isEditing = editingId === item.id;
    const done = !!item.completedAt;

    return (
      <View style={[styles.todoItem, done && styles.todoItemDone]}>
        <TouchableOpacity onPress={() => toggleDone(item.id)} style={styles.checkbox}>
          <View style={[styles.checkboxInner, done && styles.checkboxChecked]}>
            {done && <Feather name="check" size={13} color="#fff" />}
          </View>
        </TouchableOpacity>

        {isEditing ? (
          <TextInput
            style={styles.editInput}
            value={editingText}
            onChangeText={setEditingText}
            onSubmitEditing={saveEdit}
            autoFocus
            returnKeyType="done"
          />
        ) : (
          <Text style={[styles.todoText, done && styles.todoTextDone]} numberOfLines={3}>
            {item.title}
          </Text>
        )}

        {isEditing ? (
          <>
            <TouchableOpacity onPress={saveEdit} style={styles.iconBtn}>
              <Feather name="check" size={18} color="#6c63ff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={cancelEdit} style={styles.iconBtn}>
              <Feather name="x" size={18} color="#999" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => startEdit(item.id, item.title)} style={styles.iconBtn}>
              <Feather name="edit-2" size={16} color="#6c63ff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteTodo(item.id)} style={styles.iconBtn}>
              <Feather name="trash-2" size={16} color="#e05c5c" />
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.container}>
          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Yeni görev ekle..."
              placeholderTextColor="#bbb"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={addTodo}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addTodo}>
              <Feather name="plus" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View style={styles.filters}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* List */}
          <FlatList
            data={visibleTodos}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={visibleTodos.length === 0 && styles.emptyContainer}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Görev yok</Text>
            }
            keyboardShouldPersistTaps="handled"
            style={styles.list}
          />

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{remaining} görev kaldı</Text>
            <TouchableOpacity onPress={clearDone}>
              <Text style={styles.clearBtn}>Tamamlananları sil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },

  // Input
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#2d2d2d',
    backgroundColor: '#fafafa',
  },
  addBtn: {
    backgroundColor: '#6c63ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Filters
  filters: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#6c63ff',
    borderColor: '#6c63ff',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // List
  list: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#bbb',
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 40,
  },

  // Todo Item
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8fc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  todoItemDone: {
    opacity: 0.55,
  },
  checkbox: {
    padding: 2,
  },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6c63ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6c63ff',
  },
  todoText: {
    flex: 1,
    fontSize: 15,
    color: '#2d2d2d',
  },
  todoTextDone: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  editInput: {
    flex: 1,
    fontSize: 15,
    color: '#2d2d2d',
    borderWidth: 2,
    borderColor: '#6c63ff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fff',
  },
  iconBtn: {
    padding: 6,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
  clearBtn: {
    fontSize: 12,
    color: '#e05c5c',
    fontWeight: '500',
  },
});
