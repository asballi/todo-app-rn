const { test, expect, openApp, text, liveTask } = require('./fixtures');

test('görev detayı otomatik kaydedilir (seçimler hemen, metin 0,5 sn sonra)', async ({ page }) => {
  await openApp(page);
  const title = page.getByLabel('Görev başlığı');
  const input = page.getByPlaceholder('Bugün için görev ekle...');
  await input.fill('Süt al');
  await input.press('Enter');
  await text(page, 'Süt al').click();
  await expect(title).toHaveValue('Süt al');
  const saved = async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('@todo/tasks')))).find(t => !t.deletedAt);

  await test.step('Kaydet butonu yok', async () => {
    await expect(page.getByText('Kaydet', { exact: true })).toHaveCount(0);
  });

  await test.step('çip seçimi hemen kaydedilir', async () => {
    await page.getByLabel('Öncelik Yüksek').click();
    await page.clock.runFor(50);
    await expect(text(page, 'Kaydedildi')).toBeVisible();
    expect((await saved()).priority).toBe(3);
  });

  await test.step('başlık 0,5 sn sonra kaydedilir', async () => {
    await title.fill('Süt ve ekmek al');
    await page.clock.runFor(300);
    expect((await saved()).title).toBe('Süt al');
    await page.clock.runFor(300);
    await expect.poll(async () => (await saved()).title).toBe('Süt ve ekmek al');
  });

  await test.step('boş başlık: uyarı; diğer değişiklik son geçerli başlıkla kaydedilir', async () => {
    await title.fill('');
    await expect(text(page, 'Görev başlığı boş olamaz')).toBeVisible();
    await page.getByLabel('Öncelik Düşük').click();
    await page.clock.runFor(600);
    await expect.poll(async () => (await saved()).priority).toBe(1);
    expect((await saved()).title).toBe('Süt ve ekmek al');
    await title.fill('Süt ve ekmek al');
    await page.clock.runFor(600);
  });

  await test.step('kontrol listesi: işaret hemen, madde metni gecikmeli', async () => {
    const add = page.getByLabel('Madde ekle');
    await add.fill('Tam yağlı');
    await add.press('Enter');
    await page.clock.runFor(50);
    await expect.poll(async () => (await saved()).checklist.map(i => [i.title, i.done])).toEqual([['Tam yağlı', false]]);
    await page.getByRole('checkbox', { name: 'Madde: Tam yağlı' }).click();
    await page.clock.runFor(50);
    await expect.poll(async () => (await saved()).checklist[0].done).toBe(true);
    await page.getByRole('textbox', { name: 'Madde: Tam yağlı' }).fill('Yarım yağlı');
    await page.clock.runFor(200);
    expect((await saved()).checklist[0].title).toBe('Tam yağlı');
    await page.clock.runFor(400);
    await expect.poll(async () => (await saved()).checklist[0].title).toBe('Yarım yağlı');
  });

  await test.step('yazıp hemen ekrandan çıkınca kaydedilir', async () => {
    await page.getByLabel('Not').fill('Marketten');
    await page.goBack();
    await expect(text(page, 'Süt ve ekmek al')).toBeVisible();
    await expect.poll(async () => (await saved()).notes).toBe('Marketten');
  });

  await test.step('yazıp hemen Tamamla: ikisi de kaydedilir', async () => {
    await text(page, 'Süt ve ekmek al').click();
    await title.fill('Süt, ekmek ve yumurta al');
    await text(page, 'Tamamlandı olarak işaretle').click();
    await expect(text(page, 'Görev tamamlandı')).toBeVisible();
    const task = await liveTask(page, 'Süt, ekmek ve yumurta al');
    expect(task.completedAt).not.toBeNull();
  });
});
