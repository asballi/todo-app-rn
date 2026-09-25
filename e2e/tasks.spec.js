const { test, expect, openApp, text, liveTask } = require('./fixtures');

const checked = locator => expect(locator).toHaveAttribute('aria-checked', 'true');

test('görev detayı: düzenle, otomatik kaydet, tamamla, sil ve tam form', async ({ page, dialogs }) => {
  await openApp(page);

  await test.step('hızlı ekleme', async () => {
    await page.getByPlaceholder('Bugün için görev ekle...').fill('Süt al');
    await page.keyboard.press('Enter');
    await expect(text(page, 'Süt al')).toBeVisible();
  });

  await test.step('detayda düzenle; yarına tarihlenen görev Yaklaşan\'a geçer', async () => {
    await text(page, 'Süt al').click();
    await page.getByLabel('Görev başlığı').fill('Süt ve ekmek al');
    await page.getByLabel('Not').fill('Tam yağlı');
    await page.getByLabel('Yarın', { exact: true }).click();
    await page.getByLabel('Saat ekle').click();
    await page.getByLabel('Saat', { exact: true }).fill('15:30');
    await page.getByLabel('Öncelik Yüksek').click();
    await page.goBack(); // ekrandan çıkınca bekleyen kayıt yapılır
    await page.getByRole('tab', { name: 'Yaklaşan' }).click();
    await expect(text(page, 'Süt ve ekmek al')).toBeVisible();
    await expect(page.getByText('Yarın 15:30').last()).toBeVisible();
    expect(await liveTask(page, 'Süt ve ekmek al')).toMatchObject({
      notes: 'Tam yağlı', dueDate: '2026-09-26', dueTime: '15:30', priority: 3,
    });
  });

  await test.step('yeniden açınca değerler dolu', async () => {
    await text(page, 'Süt ve ekmek al').click();
    await expect(page.getByLabel('Görev başlığı')).toHaveValue('Süt ve ekmek al');
    await expect(page.getByLabel('Saat', { exact: true })).toHaveValue('15:30');
    await checked(page.getByLabel('Yarın', { exact: true }));
    await checked(page.getByLabel('Öncelik Yüksek'));
  });

  await test.step('tarih kaldırılınca saat de kalkar', async () => {
    await page.getByLabel('Tarih yok').click();
    await expect(page.getByLabel('Saat', { exact: true })).toHaveCount(0);
    await page.goBack();
    await expect.poll(async () => (await liveTask(page, 'Süt ve ekmek al')).dueDate).toBeNull();
    expect((await liveTask(page, 'Süt ve ekmek al')).dueTime).toBeNull();
  });

  await test.step('tamamla (tarihsiz görev Gelen Kutusu\'nda)', async () => {
    await page.goto('/lists/category/inbox');
    await text(page, 'Süt ve ekmek al').click();
    await text(page, 'Tamamlandı olarak işaretle').click();
    await text(page, 'Tamamlananlar (1)').click();
    await expect(text(page, 'Süt ve ekmek al')).toBeVisible();
    expect((await liveTask(page, 'Süt ve ekmek al')).completedAt).not.toBeNull();
  });

  await test.step('sil: onay sorulmaz', async () => {
    await text(page, 'Süt ve ekmek al').click();
    await text(page, 'Görevi sil').click();
    await expect(text(page, 'Bu kategoride açık görev yok')).toBeVisible();
    await expect(page.getByText('Tamamlananlar (1)')).toHaveCount(0);
    expect(dialogs).toEqual([]);
  });

  await test.step('hızlı eklemeden tam form: başlık taşınır, tarih seçilir', async () => {
    await page.getByPlaceholder('Gelen Kutusu listesine ekle...').fill('Detaylı görev');
    await page.getByLabel('Ayrıntılı görev ekle').last().click();
    await expect(page.getByLabel('Görev başlığı')).toHaveValue('Detaylı görev');
    await page.getByLabel('Bugün', { exact: true }).last().click();
    await page.getByLabel('Tarih', { exact: true }).fill('2026-10-03');
    await text(page, 'Oluştur').click();
    await expect(text(page, 'Detaylı görev')).toBeVisible();
    expect((await liveTask(page, 'Detaylı görev')).dueDate).toBe('2026-10-03');
  });

  await test.step('kategori ekranından tam form: kategori ön seçili', async () => {
    await page.getByRole('tab', { name: 'Listeler' }).click();
    await page.getByLabel('Yeni kategori').click();
    await page.getByPlaceholder('Kategori adı').fill('İş');
    await text(page, 'Oluştur').click();
    await text(page, 'İş').click();
    await page.getByPlaceholder('İş listesine ekle...').fill('Sunum');
    await page.getByLabel('Ayrıntılı görev ekle').last().click();
    await checked(page.getByLabel('Kategori İş'));
    await expect(page.getByLabel('Kategori Gelen Kutusu')).toHaveAttribute('aria-checked', 'false');
    await text(page, 'Oluştur').click();
    await expect(text(page, 'Sunum')).toBeVisible();
  });

  await test.step('doğrudan URL: bilinmeyen görev → /today', async () => {
    await page.goto('/task/yok');
    await expect(page).toHaveURL(/\/today$/);
  });

  await test.step('doğrudan URL: geçersiz parametreler yok sayılır', async () => {
    await page.goto('/task/new?categoryId=yok&dueDate=2026-02-30&priority=9&dueTime=99:99');
    await page.getByLabel('Görev başlığı').fill('URL görevi');
    await checked(page.getByLabel('Kategori Gelen Kutusu'));
    await checked(page.getByLabel('Tarih yok'));
    await checked(page.getByLabel('Öncelik Yok'));
    await text(page, 'Oluştur').click();
    await expect.poll(async () => (await liveTask(page, 'URL görevi'))?.categoryId).toBe('inbox');
  });
});
