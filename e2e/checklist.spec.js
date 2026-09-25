const { test, expect, openApp, text, stored, liveTask, record, INBOX } = require('./fixtures');

test('kontrol listesi: şema 2 → 3 taşıma, ekle/işaretle/düzenle/sil, ilerleme, arama', async ({ page }) => {
  // v2 biçiminde veri: görevde kontrol listesi alanı yok.
  const legacyTask = record('m1', {
    title: 'Market', notes: '', categoryId: 'inbox', dueDate: '2026-09-25', dueTime: null, priority: 0, completedAt: null,
  });
  await openApp(page, { seed: { schemaVersion: 2, categories: [INBOX], tags: [], taskTags: [], tasks: [legacyTask] } });
  const add = page.getByLabel('Madde ekle');

  await test.step('şema 3\'e taşınır, yeni alanlar boş değerlerle eklenir', async () => {
    await expect(text(page, 'Market')).toBeVisible();
    expect(await stored(page, 'schemaVersion')).toBe(3);
    expect(await liveTask(page, 'Market')).toMatchObject({ checklist: [], reminders: [], recurrence: null, nextTaskId: null });
  });

  await test.step('madde ekle (Enter, odak kalır), işaretle, düzenle, sil; boş madde atılır', async () => {
    await text(page, 'Market').click();
    for (const item of ['Süt', 'Yoğurt', 'Ekmek', 'Silinecek']) {
      await add.fill(item);
      await add.press('Enter');
    }
    await expect(add).toHaveValue('');
    await expect(add).toBeFocused();
    await page.getByRole('checkbox', { name: 'Madde: Süt' }).click();
    await page.getByRole('textbox', { name: 'Madde: Ekmek' }).fill('Tam buğday ekmek');
    await page.getByLabel('"Silinecek" maddesini sil').click();
    await page.goBack();
    await expect(page.getByLabel('Kontrol listesi: 1/3 tamamlandı')).toHaveCount(1);
    expect((await liveTask(page, 'Market')).checklist.map(i => [i.title, i.done])).toEqual([
      ['Süt', true], ['Yoğurt', false], ['Tam buğday ekmek', false],
    ]);
  });

  await test.step('metni boşaltılan madde kaydedilirken atılır', async () => {
    await text(page, 'Market').click();
    await page.getByRole('textbox', { name: 'Madde: Yoğurt' }).fill('');
    await page.goBack();
    await expect.poll(async () => (await liveTask(page, 'Market')).checklist.map(i => i.title)).toEqual([
      'Süt', 'Tam buğday ekmek',
    ]);
  });

  await test.step('arama madde metninde de bulur', async () => {
    await page.getByRole('tab', { name: 'Ara' }).click();
    await page.getByLabel('Görevlerde ara').fill('bugday');
    await expect(text(page, '1 sonuç')).toBeVisible();
  });

  await test.step('yeni görev formunda kontrol listesi', async () => {
    await page.goto('/task/new?dueDate=2026-09-25');
    await page.getByLabel('Görev başlığı').fill('Bavul');
    await add.fill('Pasaport');
    await add.press('Enter');
    await text(page, 'Oluştur').click();
    await expect(text(page, 'Bavul')).toBeVisible();
    expect((await liveTask(page, 'Bavul')).checklist.map(i => [i.title, i.done])).toEqual([['Pasaport', false]]);
  });
});
