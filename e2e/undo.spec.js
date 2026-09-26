const { test, expect, openApp, text, stored, liveTask } = require('./fixtures');

test('geri alma şeridi: tamamlama, silme, toplu silme, kategori silme', async ({ page, dialogs }) => {
  await openApp(page);
  const quickAdd = async title => {
    const input = page.getByPlaceholder('Bugün için görev ekle...');
    await input.fill(title);
    await input.press('Enter');
    await expect(text(page, title)).toBeVisible();
  };
  const undoBar = page.getByRole('alert');

  await test.step('tamamla → şerit → geri al', async () => {
    await quickAdd('Süt al');
    await page.getByRole('checkbox', { name: 'Süt al' }).click();
    await expect(text(page, 'Görev tamamlandı')).toBeVisible();
    await text(page, 'Geri al').click();
    await expect(page.getByRole('checkbox', { name: 'Süt al' })).toHaveAttribute('aria-checked', 'false');
    await expect(undoBar).toHaveCount(0);
  });

  await test.step('şerit 5 saniye sonra kapanır', async () => {
    await page.getByRole('checkbox', { name: 'Süt al' }).click();
    await expect(text(page, 'Görev tamamlandı')).toBeVisible();
    await page.clock.runFor(4000);
    await expect(undoBar).toHaveCount(1);
    await page.clock.runFor(1500);
    await expect(undoBar).toHaveCount(0);
  });

  await test.step('detaydan sil: onay sorulmaz, geri alınır', async () => {
    await quickAdd('Ekmek al');
    await text(page, 'Ekmek al').click();
    await text(page, 'Görevi sil').click();
    await expect(text(page, 'Görev silindi')).toBeVisible();
    await expect(page).toHaveURL(/\/today$/);
    await text(page, 'Geri al').click();
    await expect(text(page, 'Ekmek al')).toBeVisible();
    expect(await liveTask(page, 'Ekmek al')).toBeTruthy();
  });

  await test.step('tamamlananları sil: onay sorulmaz, geri alınır', async () => {
    await text(page, 'Tamamlananlar (1)').click();
    await text(page, 'Tamamlananları sil').click();
    await expect(text(page, 'Görev silindi')).toBeVisible();
    await expect(page.getByText('Tamamlananlar (1)')).toHaveCount(0);
    await text(page, 'Geri al').click();
    await expect(text(page, 'Tamamlananlar (1)')).toBeVisible();
    expect(dialogs).toEqual([]);
  });

  await test.step('kategori silme: onay sorulur; geri alınınca görevler kategoriye döner', async () => {
    await page.getByRole('tab', { name: 'Listeler' }).click();
    await page.getByLabel('Yeni kategori').click();
    await page.getByPlaceholder('Kategori adı').fill('İş');
    await text(page, 'Oluştur').click();
    await page.getByText('İş', { exact: true }).first().click();
    const input = page.getByPlaceholder('İş listesine ekle...');
    await input.fill('Rapor');
    await input.press('Enter');
    await expect(text(page, 'Rapor')).toBeVisible();
    await page.getByLabel('Kategoriyi düzenle').click();
    await text(page, 'Kategoriyi sil').click();
    await expect(text(page, '"İş" kategorisi silindi')).toBeVisible();
    expect(dialogs).toHaveLength(1);
    await text(page, 'Geri al').click();
    await expect.poll(async () => {
      const [categories, tasks] = await Promise.all([stored(page, 'categories'), stored(page, 'tasks')]);
      const work = categories.find(c => c.name === 'İş');
      return [!work.deletedAt, tasks.find(t => t.title === 'Rapor').categoryId === work.id];
    }).toEqual([true, true]);
  });
});
