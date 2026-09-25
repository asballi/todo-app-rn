const { test, expect, openApp, text, liveTask } = require('./fixtures');

test('Bugün, Yaklaşan ve Gecikmiş listeleri (sabit saat: Cuma 25 Eylül 10:00)', async ({ page, dialogs }) => {
  await openApp(page);
  const quickAdd = page.getByPlaceholder('Bugün için görev ekle...');

  await test.step('tarih başlığı ve boş durum', async () => {
    await expect(text(page, 'Cuma, 25 Eylül')).toBeVisible();
    await expect(text(page, 'Bugün için görev yok')).toBeVisible();
  });

  await test.step('Bugün\'de hızlı ekleme bugüne tarihler', async () => {
    await quickAdd.fill('Bugünkü iş');
    await quickAdd.press('Enter');
    await expect(text(page, 'Bugünkü iş')).toBeVisible();
    expect((await liveTask(page, 'Bugünkü iş')).dueDate).toBe('2026-09-25');
  });

  await test.step('10:30\'lu görev; saat geçince ekran açıkken Gecikmiş\'e geçer', async () => {
    await quickAdd.fill('Toplantı');
    await page.getByLabel('Ayrıntılı görev ekle').click();
    await page.getByLabel('Saat ekle').click();
    await page.getByLabel('Saat', { exact: true }).fill('10:30');
    await text(page, 'Oluştur').click();
    await expect(text(page, 'Toplantı')).toBeVisible();
    await expect(page.getByText('Gecikmiş', { exact: true })).toHaveCount(0);

    await page.clock.runFor(61 * 60 * 1000);
    await expect(text(page, 'Gecikmiş')).toBeVisible();
    const y = async label => (await text(page, label).boundingBox()).y;
    expect(await y('Gecikmiş')).toBeLessThan(await y('Toplantı'));
    expect(await y('Toplantı')).toBeLessThan(await y('Bugünkü iş'));
  });

  await test.step('tamamla → katlanmış Tamamlananlar (1); aç ve onaysız sil', async () => {
    await page.getByRole('checkbox', { name: 'Bugünkü iş' }).click();
    await expect(text(page, 'Tamamlananlar (1)')).toBeVisible();
    await expect(page.getByText('Bugünkü iş', { exact: true })).toHaveCount(0);
    await text(page, 'Tamamlananlar (1)').click();
    await expect(text(page, 'Bugünkü iş')).toBeVisible();
    await text(page, 'Tamamlananları sil').click();
    await expect(page.getByText('Tamamlananlar (1)')).toHaveCount(0);
    expect(dialogs).toEqual([]);
  });

  await test.step('Yaklaşan: yarından itibaren 7 gün; gün başına ekleme', async () => {
    await page.getByRole('tab', { name: 'Yaklaşan' }).click();
    for (const day of ['Yarın', 'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma']) {
      await expect(page.getByLabel(`${day} için görev ekle`)).toHaveCount(1);
    }
    await page.getByLabel('Pazartesi için görev ekle').click();
    await page.getByLabel('Görev başlığı').fill('Pazartesi işi');
    await expect(page.getByLabel('Tarih', { exact: true })).toHaveValue('2026-09-28');
    await text(page, 'Oluştur').click();
    await expect(text(page, 'Pazartesi işi')).toBeVisible();
  });

  await test.step('Listeler → Gecikmiş listesi', async () => {
    await page.getByRole('tab', { name: 'Listeler' }).click();
    await text(page, 'Gecikmiş').click();
    await expect(text(page, 'Toplantı')).toBeVisible();
  });

  await test.step('tarihsiz görev Bugün\'de görünmez, Gelen Kutusu\'nda görünür', async () => {
    await page.goto('/lists/category/inbox');
    const inbox = page.getByPlaceholder('Gelen Kutusu listesine ekle...');
    await inbox.fill('Tarihsiz iş');
    await inbox.press('Enter');
    await expect(text(page, 'Tarihsiz iş')).toBeVisible();
    // Doğrudan açılışta yalnızca Bugün sekmesi yüklenir; gizli sekmeler sayılmaz.
    await page.goto('/today');
    await expect(text(page, 'Toplantı')).toBeVisible();
    await expect(page.getByText('Tarihsiz iş', { exact: true })).toHaveCount(0);
    await expect(text(page, 'Görev yok')).toBeVisible(); // Gecikmiş varken boş "Bugün" bölümü
  });
});
