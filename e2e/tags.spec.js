const { test, expect, openApp, text, stored } = require('./fixtures');

async function liveTagNames(page, title) {
  const [tasks, tags, links] = await Promise.all(['tasks', 'tags', 'taskTags'].map(k => stored(page, k)));
  const task = tasks.find(t => t.title === title && !t.deletedAt);
  return links
    .filter(l => l.taskId === task.id && !l.deletedAt)
    .map(l => tags.find(t => t.id === l.tagId).name)
    .sort();
}

test('etiketler: yazarak oluşturma, öneriler, etiket ekranı, yönetim ve silme', async ({ page, dialogs }) => {
  await openApp(page);
  const tagInput = page.getByLabel('Etiket ara veya oluştur');
  await page.getByPlaceholder('Bugün için görev ekle...').fill('Müşteriyi ara');
  await page.keyboard.press('Enter');

  await test.step('etiket yokken Listeler\'de yol gösteren mesaj', async () => {
    await page.getByRole('tab', { name: 'Listeler' }).click();
    await expect(text(page, 'Henüz etiket yok. Görev düzenlerken etiket ekleyebilirsin.')).toBeVisible();
    await page.getByRole('tab', { name: 'Bugün' }).click();
  });

  await test.step('görevde yazarak etiket oluştur (çip ve Enter)', async () => {
    await text(page, 'Müşteriyi ara').click();
    await tagInput.fill('Acil');
    await text(page, '"Acil" oluştur').click();
    await tagInput.fill('telefon');
    await tagInput.press('Enter');
    await expect(page.getByLabel('Etiket telefon')).toHaveAttribute('aria-checked', 'true');
    await expect(tagInput).toHaveValue('');
    await page.goBack();
    await expect(text(page, '#Acil')).toBeVisible();
    await expect.poll(() => liveTagNames(page, 'Müşteriyi ara')).toEqual(['Acil', 'telefon']);
  });

  await test.step('öneriler Türkçe büyük harfi eşleştirir; seçim kaldırılır', async () => {
    await text(page, 'Müşteriyi ara').click();
    await tagInput.fill('ACİ');
    // "Acil" zaten seçili olduğu için öneri olarak tekrar çıkmaz; "ACİ" adı yeni sayılır.
    await expect(page.getByText('"ACİ" oluştur')).toHaveCount(1);
    await tagInput.fill('');
    await page.getByLabel('Etiket telefon').click();
    await expect(page.getByLabel('Etiket telefon')).toHaveAttribute('aria-checked', 'false');
    await page.goBack();
    await expect.poll(() => liveTagNames(page, 'Müşteriyi ara')).toEqual(['Acil']);
  });

  let acilId;
  await test.step('Listeler\'de etiketler', async () => {
    await page.getByRole('tab', { name: 'Listeler' }).click();
    await expect(text(page, 'Acil')).toBeVisible();
    await expect(text(page, 'telefon')).toBeVisible();
    acilId = (await stored(page, 'tags')).find(t => t.name === 'Acil').id;
  });

  await test.step('etiket ekranında hızlı ekleme etiketi ekler', async () => {
    await text(page, 'Acil').click();
    await page.getByPlaceholder('#Acil etiketiyle ekle...').fill('Yedek al');
    await page.keyboard.press('Enter');
    await expect(text(page, 'Yedek al')).toBeVisible();
    await expect.poll(() => liveTagNames(page, 'Yedek al')).toEqual(['Acil']);
  });

  await test.step('etiket ekranında ayrıntılı ekleme etiketi ön seçer', async () => {
    await page.getByPlaceholder('#Acil etiketiyle ekle...').fill('Rapor');
    await page.getByLabel('Ayrıntılı görev ekle').last().click();
    await expect(page.getByLabel('Etiket Acil')).toHaveAttribute('aria-checked', 'true');
    await text(page, 'Oluştur').click();
    await expect(text(page, 'Rapor')).toBeVisible();
  });

  await test.step('yönetim: aynı adda yeni etiket reddedilir', async () => {
    await page.getByRole('tab', { name: 'Listeler' }).click();
    await page.getByLabel('Etiketleri yönet').click();
    await page.getByLabel('Yeni etiket').click();
    await page.getByPlaceholder('Etiket adı').fill('ACİL');
    await text(page, 'Oluştur').click();
    await expect.poll(() => dialogs.at(-1)).toBe('Bu adla bir etiket zaten var');
    await page.goBack();
  });

  await test.step('yönetim: yeniden adlandır ve renk ver', async () => {
    await text(page, 'telefon').click();
    await page.getByPlaceholder('Etiket adı').fill('Telefon');
    await page.getByLabel('Renk #3b82f6').click();
    await text(page, 'Kaydet').click();
    await expect(text(page, 'Telefon')).toBeVisible();
    expect((await stored(page, 'tags')).find(t => t.name === 'Telefon')).toMatchObject({ color: '#3b82f6', nameKey: 'telefon' });
  });

  await test.step('silme: onay görev sayısını söyler; bağlar kalkar, görevler kalır', async () => {
    await page.goto(`/lists/tag/${acilId}`);
    await page.getByLabel('Etiketi düzenle').click();
    await text(page, 'Etiketi sil').click();
    await expect(page).toHaveURL(/\/lists$/);
    expect(dialogs.at(-1)).toBe('#Acil silinsin mi?\n\nEtiket 3 görevden kaldırılacak; görevler silinmez.');
    const [tasks, links] = await Promise.all([stored(page, 'tasks'), stored(page, 'taskTags')]);
    expect(tasks.filter(t => !t.deletedAt)).toHaveLength(3);
    expect(links.filter(l => !l.deletedAt)).toHaveLength(0);
  });

  await test.step('doğrudan URL: silinmiş etiket ve bilinmeyen form → /lists', async () => {
    await page.goto(`/lists/tag/${acilId}`);
    await expect(page).toHaveURL(/\/lists$/);
    await page.goto('/tag-form?id=yok');
    await expect(page).toHaveURL(/\/lists$/);
  });
});
