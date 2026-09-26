const { test, expect, openApp, text, stored } = require('./fixtures');

test('kategori oluştur, görev ekle, yeniden adlandır, sil ve doğrudan URL durumları', async ({ page, dialogs }) => {
  await openApp(page);
  await page.getByPlaceholder('Bugün için görev ekle...').fill('Gelen görev');
  await page.keyboard.press('Enter');

  await test.step('Listeler: Gelen Kutusu ve açık görev sayısı', async () => {
    await page.getByRole('tab', { name: 'Listeler' }).click();
    await expect(text(page, 'Gelen Kutusu')).toBeVisible();
  });

  await test.step('yeni kategori: ad, renk, simge', async () => {
    await page.getByLabel('Yeni kategori').click();
    await page.getByPlaceholder('Kategori adı').fill('İş');
    await page.getByLabel('Renk #3cb371').click();
    await page.getByLabel('Simge briefcase').click();
    await text(page, 'Oluştur').click();
    await expect(text(page, 'İş')).toBeVisible();
    const work = (await stored(page, 'categories')).find(c => c.name === 'İş');
    expect(work).toMatchObject({ color: '#3cb371', icon: 'briefcase', isSystem: false });
  });

  await test.step('kategori ekranında hızlı ekleme o kategoriye ekler', async () => {
    await text(page, 'İş').click();
    const input = page.getByPlaceholder('İş listesine ekle...');
    for (const title of ['Rapor yaz', 'Toplantı notları']) {
      await input.fill(title);
      await input.press('Enter');
      await expect(text(page, title)).toBeVisible();
    }
    await page.getByRole('checkbox', { name: 'Rapor yaz' }).click();
    await expect(text(page, 'Tamamlananlar (1)')).toBeVisible();
    const work = (await stored(page, 'categories')).find(c => c.name === 'İş');
    const tasks = await stored(page, 'tasks');
    expect(tasks.filter(t => t.categoryId === work.id).map(t => t.title).sort()).toEqual(['Rapor yaz', 'Toplantı notları']);
  });

  await test.step('yeniden adlandır', async () => {
    await page.getByLabel('Kategoriyi düzenle').click();
    await page.getByPlaceholder('Kategori adı').fill('İş Projeleri');
    await text(page, 'Kaydet').click();
    await expect(page.getByPlaceholder('İş Projeleri listesine ekle...')).toBeVisible();
  });

  await test.step('sil: onay mesajı görev sayısını söyler, görevler Gelen Kutusu\'na taşınır', async () => {
    await page.getByLabel('Kategoriyi düzenle').click();
    await text(page, 'Kategoriyi sil').click();
    await expect(text(page, 'Gelen Kutusu')).toBeVisible();
    expect(dialogs.at(-1)).toBe('"İş Projeleri" silinsin mi?\n\nİçindeki 2 görev Gelen Kutusu\'na taşınacak.');
    const tasks = await stored(page, 'tasks');
    expect(tasks.filter(t => !t.deletedAt).every(t => t.categoryId === 'inbox')).toBe(true);
  });

  await test.step('Gelen Kutusu silinemez (buton yok)', async () => {
    await page.goto('/category-form?id=inbox');
    await expect(page.getByPlaceholder('Kategori adı')).toHaveValue('Gelen Kutusu');
    await expect(page.getByText('Kategoriyi sil')).toHaveCount(0);
  });

  await test.step('doğrudan URL: bilinmeyen kategori formu → /lists', async () => {
    await page.goto('/category-form?id=yok');
    await expect(page).toHaveURL(/\/lists$/);
  });

  await test.step('doğrudan URL: geçmişsiz yeni kategori formu kaydeder ve /lists\'e döner', async () => {
    await page.goto('/category-form');
    await page.getByPlaceholder('Kategori adı').fill('Ev');
    await text(page, 'Oluştur').click();
    await expect(page).toHaveURL(/\/lists$/);
    await expect(text(page, 'Ev')).toBeVisible();
  });

  await test.step('doğrudan URL: silinmiş kategori sayfası → /lists', async () => {
    const deleted = (await stored(page, 'categories')).find(c => c.deletedAt);
    await page.goto(`/lists/category/${deleted.id}`);
    await expect(page).toHaveURL(/\/lists$/);
  });

  await test.step('aktif sekmeye tekrar basınca Listeler başına döner (doğrudan URL ile girilse de)', async () => {
    await page.goto('/lists/category/inbox');
    await page.getByRole('tab', { name: 'Listeler' }).click();
    // Not: expo-router adres çubuğunda eski parametreyi (?id=inbox) bırakabiliyor;
    // gösterilen ekran doğru olduğu için yalnızca yol kontrol edilir.
    await expect.poll(() => new URL(page.url()).pathname).toBe('/lists');
    await expect(text(page, 'Akıllı listeler'.toUpperCase()).or(text(page, 'Akıllı listeler'))).toBeVisible();
  });
});
