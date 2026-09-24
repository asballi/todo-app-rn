// Key the app used to keep todos on the device before cloud sync.
export const LOCAL_TODOS_KEY = '@todos';

// Moves todos saved on this device into the signed-in user's account.
export async function migrateLocalTodos(storage, backend, uid) {
  const json = await storage.getItem(LOCAL_TODOS_KEY);
  const localTodos = json ? JSON.parse(json) : [];

  const existing = await backend.fetchTodos(uid);
  const existingTexts = new Set(existing.map(t => t.text));

  for (const todo of localTodos) {
    if (existingTexts.has(todo.text)) continue;
    existingTexts.add(todo.text);
    // Local ids were Date.now() timestamps, so they keep the original order.
    await backend.createTodo(uid, { text: todo.text, done: todo.done, createdAt: todo.id });
  }

  await storage.removeItem(LOCAL_TODOS_KEY);
}
