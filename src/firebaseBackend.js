import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

// Firestore implementation of the backend interface used by todoRepository
// and migrateLocalTodos (see src/testing/memoryBackend.js for the test double).
// Todos live at users/{uid}/todos/{todoId}.
export function createFirebaseBackend(db) {
  const todosOf = uid => collection(db, 'users', uid, 'todos');
  const toTodos = snapshot => snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  return {
    listenTodos(uid, onChange) {
      return onSnapshot(
        todosOf(uid),
        snapshot => onChange(toTodos(snapshot)),
        error => console.warn('Görevler dinlenemedi', error)
      );
    },
    async fetchTodos(uid) {
      return toTodos(await getDocs(todosOf(uid)));
    },
    async createTodo(uid, data) {
      const ref = await addDoc(todosOf(uid), data);
      return ref.id;
    },
    async updateTodo(uid, id, patch) {
      await updateDoc(doc(todosOf(uid), id), patch);
    },
    async deleteTodo(uid, id) {
      await deleteDoc(doc(todosOf(uid), id));
    },
  };
}
