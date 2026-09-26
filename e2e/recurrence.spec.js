const { test, expect, openApp, text, stored } = require('./fixtures');

const live = async (page, title) => (await stored(page, 'tasks')).filter(t => t.title === title && !t.deletedAt);

test('tekrarlayan görevler: hazır ve özel kural, tamamlama/geri alma, tarih kalkınca tekrar kalkar', async ({ page }) => {
  await openApp(page);

  await test.step('tekrar seçici yalnızca tarih varken görünür', async () => {
    await page.goto('/task/new');
    await page.getByLabel('Görev başlığı').fill('Çiçek sula');
    await expect(page.getByText('Tekrar yok')).toHaveCount(0);
    await page.getByLabel('Bugün', { exact: true }).click();
    await page.getByLabel('Her gün', { exact: true }).click();
    await expect(text(page, 'Tekrarlıyor: Her gün')).toBeVisible();
    await text(page, 'Oluştur').click();
    await expect(text(page, 'Çiçek sula')).toBeVisible();
    await expect(page.getByLabel('Tekrarlıyor: Her gün')).toHaveCount(1); // satırdaki simge
    expect((await live(page, 'Çiçek sula'))[0].recurrence).toEqual({
      unit: 'day', interval: 1, weekdays: null, from: 'due', monthDay: null,
    });
  });

  await test.step('tamamlayınca yarına yeni görev oluşur', async () => {
    await page.getByRole('checkbox', { name: 'Çiçek sula' }).click();
    await expect(text(page, 'Tamamlananlar (1)')).toBeVisible();
    await page.getByRole('tab', { name: 'Yaklaşan' }).click();
    await expect(text(page, 'Çiçek sula')).toBeVisible();
    const tasks = await live(page, 'Çiçek sula');
    expect(tasks.map(t => [t.dueDate, !!t.completedAt])).toEqual([['2026-09-25', true], ['2026-09-26', false]]);
    expect(tasks[0].nextTaskId).toBe(tasks[1].id);
  });

  await test.step('işaret kaldırılınca oluşan görev silinir', async () => {
    await page.getByRole('tab', { name: 'Bugün' }).click();
    await text(page, 'Tamamlananlar (1)').click();
    await page.getByRole('checkbox', { name: 'Çiçek sula' }).last().click();
    await expect.poll(async () => (await live(page, 'Çiçek sula')).map(t => [t.dueDate, !!t.completedAt, t.nextTaskId]))
      .toEqual([['2026-09-25', false, null]]);
  });

  let sporId;
  await test.step('özel kural: 2 haftada bir Pzt ve Çar, tamamlanınca say', async () => {
    await page.goto('/task/new?dueDate=2026-09-25');
    await page.getByLabel('Görev başlığı').fill('Spor');
    await page.getByLabel('Özel', { exact: true }).click();
    await page.getByLabel('hafta', { exact: true }).click();
    await page.getByLabel('Aralığı artır').click();
    await page.getByLabel('Pzt', { exact: true }).click();
    await page.getByLabel('Çar', { exact: true }).click();
    await page.getByLabel('Tamamlanınca say').click();
    await expect(page.getByText('Tekrarlıyor: Her 2 haftada bir: Pzt, Çar (tamamlandıktan sonra)')).toBeVisible();
    await text(page, 'Oluştur').click();
    await expect(text(page, 'Spor')).toBeVisible();
    expect((await live(page, 'Spor'))[0].recurrence).toEqual({
      unit: 'week', interval: 2, weekdays: [1, 3], from: 'completion', monthDay: null,
    });
    await page.getByRole('checkbox', { name: 'Spor' }).click();
    // Cuma tamamlandı → seçili günler bitti → 2 hafta sonraki Pazartesi
    await expect.poll(async () => (await live(page, 'Spor')).find(t => !t.completedAt)?.dueDate).toBe('2026-10-05');
    sporId = (await live(page, 'Spor')).find(t => !t.completedAt).id;
  });

  await test.step('detayda kural görünür; tarih kaldırılınca tekrar kalkar', async () => {
    await page.goto(`/task/${sporId}`);
    await expect(page.getByText('Tekrarlıyor: Her 2 haftada bir: Pzt, Çar (tamamlandıktan sonra)')).toBeVisible();
    await page.getByLabel('Tarih yok').click();
    await expect(page.getByText('Tekrar yok')).toHaveCount(0);
    await expect(text(page, 'Kaydedildi')).toBeVisible();
    const task = (await live(page, 'Spor')).find(t => t.id === sporId);
    expect([task.dueDate, task.recurrence]).toEqual([null, null]);
  });
});
