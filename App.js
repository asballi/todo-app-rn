import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, backend } from './src/firebase';
import { isFirebaseConfigured } from './src/firebaseConfig';
import { createTodoRepository } from './src/todoRepository';
import { migrateLocalTodos } from './src/migrateLocalTodos';
import AuthScreen from './src/AuthScreen';

const FILTERS = ['Tümü', 'Aktif', 'Tamamlanan'];

export default function App() {
  // undefined while Firebase is still restoring the session, null when signed out.
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (!isFirebaseConfigured) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <Text style={styles.emptyText}>
          Firebase ayarları eksik. src/firebaseConfig.js dosyasını doldurun.
        </Text>
      </SafeAreaView>
    );
  }
  if (user === undefined) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <ActivityIndicator color="#6c63ff" size="large" />
      </SafeAreaView>
    );
  }
  if (!user) return <AuthScreen />;
  return <TodoScreen user={user} />;
}

function TodoScreen({ user }) {
  const repo = useMemo(() => createTodoRepository(backend, user.uid), [user.uid]);
  const [todos, setTodos] = useState([]);
  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState('Tümü');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => repo.subscribe(setTodos), [repo]);

  useEffect(() => {
    // If this fails (e.g. offline) the local copy is kept and retried next launch.
    migrateLocalTodos(AsyncStorage, backend, user.uid).catch(e =>
      console.warn('Eski görevler aktarılamadı', e)
    );
  }, [user.uid]);

  function addTodo() {
    repo.add(inputText);
    setInputText('');
  }

  function toggleDone(item) {
    repo.setDone(item.id, !item.done);
  }

  function deleteTodo(id) {
    repo.remove(id);
  }

  function startEdit(id, text) {
    setEditingId(id);
    setEditingText(text);
  }

  function saveEdit() {
    if (!editingText.trim()) return;
    repo.edit(editingId, editingText);
    setEditingId(null);
    setEditingText('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText('');
  }

  function clearDone() {
    repo.clearDone();
  }

  const visibleTodos = todos.filter(t => {
    if (filter === 'Aktif') return !t.done;
    if (filter === 'Tamamlanan') return t.done;
    return true;
  });

  const remaining = todos.filter(t => !t.done).length;

  function renderItem({ item }) {
    const isEditing = editingId === item.id;

    return (
      <View style={[styles.todoItem, item.done && styles.todoItemDone]}>
        <TouchableOpacity onPress={() => toggleDone(item)} style={styles.checkbox}>
          <View style={[styles.checkboxInner, item.done && styles.checkboxChecked]}>
            {item.done && <Feather name="check" size={13} color="#fff" />}
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
          <Text style={[styles.todoText, item.done && styles.todoTextDone]} numberOfLines={3}>
            {item.text}
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
            <TouchableOpacity onPress={() => startEdit(item.id, item.text)} style={styles.iconBtn}>
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
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ecebff" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Yapılacaklar</Text>
            <TouchableOpacity onPress={() => signOut(auth)} style={styles.logoutBtn}>
              <Feather name="log-out" size={18} color="#999" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userEmail}>{user.email}</Text>

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
            keyExtractor={item => item.id.toString()}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ecebff',
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
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a2e',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  header: {
    justifyContent: 'center',
  },
  logoutBtn: {
    position: 'absolute',
    right: 0,
    padding: 6,
  },
  userEmail: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
