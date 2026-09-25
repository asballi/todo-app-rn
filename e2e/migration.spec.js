const { test, expect, openApp, text, stored } = require('./fixtures');

test('eski @todos verisi taşınır, derin bağlantı yükleme sırasında çalışır, veriler kalıcıdır', async ({ page }) => {
  await openApp(page, {
    path: '/lists',
    seed: {
      legacyTodos: [
        { id: 1700000000000, text: 'Eski açık', done: false },
        { id: 1700000000001, text: 'Eski bitmiş', done: true },
      ],
    },
  });

  await test.step('taşıma sonrası anahtarlar ve şema sürümü', async () => {
    await expect(page).toHaveURL(/\/lists$/);
    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    expect(keys).toEqual(['@todo/categories', '@todo/schemaVersion', '@todo/tags', '@todo/taskTags', '@todo/tasks']);
    expect(await stored(page, 'schemaVersion')).toBe(3);
    expect((await stored(page, 'categories')).map(c => c.name)).toEqual(['Gelen Kutusu']);
    const tasks = await stored(page, 'tasks');
    expect(tasks.map(t => [t.title, !!t.completedAt])).toEqual([['Eski açık', false], ['Eski bitmiş', true]]);
    expect(tasks[0]).toMatchObject({ checklist: [], reminders: [], recurrence: null, nextTaskId: null });
  });

  await test.step('taşınan görevler Gelen Kutusu\'nda, yeniden yüklemede kalır', async () => {
    await page.goto('/lists/category/inbox');
    await expect(text(page, 'Eski açık')).toBeVisible();
    await page.reload();
    await expect(text(page, 'Eski açık')).toBeVisible();
    await expect(text(page, 'Tamamlananlar (1)')).toBeVisible();
  });
});
