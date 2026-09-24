export function createTodoRepository(backend, uid, { now = Date.now } = {}) {
  return {
    subscribe(onChange) {
      return backend.listenTodos(uid, todos =>
        onChange([...todos].sort((a, b) => a.createdAt - b.createdAt))
      );
    },
    async add(text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      await backend.createTodo(uid, { text: trimmed, done: false, createdAt: now() });
    },
    async edit(id, text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      await backend.updateTodo(uid, id, { text: trimmed });
    },
    async setDone(id, done) {
      await backend.updateTodo(uid, id, { done });
    },
    async remove(id) {
      await backend.deleteTodo(uid, id);
    },
    async clearDone() {
      const todos = await backend.fetchTodos(uid);
      await Promise.all(
        todos.filter(t => t.done).map(t => backend.deleteTodo(uid, t.id))
      );
    },
  };
}
