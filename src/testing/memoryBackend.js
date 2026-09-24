// In-memory stand-in for the Firestore backend, used only in tests.
// Implements the same interface as src/firebaseBackend.js.
export function createMemoryBackend() {
  const todosByUser = {};
  const listenersByUser = {};
  let nextId = 1;

  function todosOf(uid) {
    if (!todosByUser[uid]) todosByUser[uid] = {};
    return todosByUser[uid];
  }

  // Like Firestore, results come back ordered by document id, and ids are
  // not sequential, so insertion order is not preserved.
  function snapshot(uid) {
    return Object.keys(todosOf(uid))
      .sort()
      .map(id => ({ id, ...todosOf(uid)[id] }));
  }

  function notify(uid) {
    (listenersByUser[uid] || []).forEach(listener => listener(snapshot(uid)));
  }

  return {
    listenTodos(uid, onChange) {
      listenersByUser[uid] = [...(listenersByUser[uid] || []), onChange];
      onChange(snapshot(uid));
      return () => {
        listenersByUser[uid] = listenersByUser[uid].filter(l => l !== onChange);
      };
    },
    async fetchTodos(uid) {
      return snapshot(uid);
    },
    async createTodo(uid, data) {
      const id = `doc${(nextId++ * 7919) % 10007}`;
      todosOf(uid)[id] = { ...data };
      notify(uid);
      return id;
    },
    async updateTodo(uid, id, patch) {
      const todos = todosOf(uid);
      if (!todos[id]) return;
      todos[id] = { ...todos[id], ...patch };
      notify(uid);
    },
    async deleteTodo(uid, id) {
      delete todosOf(uid)[id];
      notify(uid);
    },
  };
}
