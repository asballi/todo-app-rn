const { test, expect, openApp, text, INBOX, taskRecord } = require('./fixtures');

test('Önemli listesi: yüksek öncelikli açık görevler; tamamlanınca listeden çıkar', async ({ page }) => {
  await openApp(page, {
    path: '/lists',
    seed: {
      schemaVersion: 3,
      categories: [INBOX],
      tags: [],
      taskTags: [],
      tasks: [
        taskRecord('a', 'Vergi beyannamesi', { priority: 3, dueDate: '2026-09-30' }),
        taskRecord('b', 'Kira', { priority: 3 }),
        taskRecord('c', 'Orta öncelik', { priority: 2 }),
        taskRecord('d', 'Bitmiş önemli', { priority: 3, completedAt: '2026-09-24T10:00:00.000Z' }),
      ],
    },
  });

  await test.step('Listeler\'de Önemli satırı ve sayısı', async () => {
    await expect(page.getByText('Önemli', { exact: true })).toBeVisible();
    await expect(text(page, '2')).toBeVisible();
  });

  await test.step('yalnızca açık yüksek öncelikliler, varsayılan sırayla', async () => {
    await text(page, 'Önemli').click();
    await expect(page).toHaveURL(/\/lists\/important$/);
    const titles = await page.getByRole('checkbox').filter({ visible: true }).evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
    expect(titles).toEqual(['Vergi beyannamesi', 'Kira']);
  });

  await test.step('tamamlanınca listeden çıkar; hepsi bitince boş durum', async () => {
    await page.getByRole('checkbox', { name: 'Vergi beyannamesi' }).click();
    await page.getByRole('checkbox', { name: 'Kira' }).click();
    await expect(text(page, 'Yüksek öncelikli açık görev yok')).toBeVisible();
  });
});
