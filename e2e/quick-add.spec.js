const { test, expect, openApp, text, stored, category, INBOX } = require('./fixtures');

async function describeTask(page, title) {
  const [tasks, tags, links, categories] = await Promise.all(['tasks', 'tags', 'taskTags', 'categories'].map(k => stored(page, k)));
  const task = tasks.find(t => t.title === title && !t.deletedAt);
  if (!task) return null;
  return {
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    priority: task.priority,
    category: categories.find(c => c.id === task.categoryId).name,
    tags: links.filter(l => l.taskId === task.id && !l.deletedAt).map(l => tags.find(g => g.id === l.tagId).name),
  };
}

test('akıllı hızlı ekleme: ayrıştırma, önizleme, varsayılanlar ve tam form', async ({ page, dialogs }) => {
  await openApp(page, {
    seed: { schemaVersion: 3, categories: [INBOX, category('work', 'İş', 'briefcase', '#3cb371', 1)], tasks: [], tags: [], taskTags: [] },
  });
  const input = page.getByPlaceholder('Bugün için görev ekle...');
  const preview = page.getByLabel('Anlaşılan değerler');

  await test.step('tam örnek: önizleme ve oluşturma', async () => {
    await input.fill('yarın 15:00 doktor #sağlık !yüksek');
    await expect(preview).toContainText('Yarın 15:00');
    await expect(preview).toContainText('sağlık');
    await expect(preview).toContainText('!Yüksek');
    await input.press('Enter');
    await expect(input).toHaveValue('');
    await expect.poll(() => describeTask(page, 'doktor')).toEqual({
      dueDate: '2026-09-26', dueTime: '15:00', priority: 3, category: 'Gelen Kutusu', tags: ['sağlık'],
    });
  });

  await test.step('yalnızca saat: Bugün ekranında bugüne', async () => {
    await input.fill('saat 14 ara');
    await expect(preview).toContainText('Bugün 14:00');
    await input.press('Enter');
    await expect.poll(() => describeTask(page, 'ara')).toMatchObject({ dueDate: '2026-09-25', dueTime: '14:00' });
  });

  await test.step('kategori ve gün adı ekran varsayılanının üzerine yazar', async () => {
    await page.goto('/lists/category/inbox');
    const inbox = page.getByPlaceholder('Gelen Kutusu listesine ekle...');
    await inbox.fill('rapor @is cuma');
    await expect(preview).toContainText('2 Eki');
    await expect(preview).toContainText('İş');
    await inbox.press('Enter');
    await expect.poll(() => describeTask(page, 'rapor')).toMatchObject({ dueDate: '2026-10-02', category: 'İş' });
  });

  await test.step('başlıksız satır: uyarı, metin korunur', async () => {
    await page.goto('/today');
    await input.fill('#acil !1');
    await input.press('Enter');
    await expect.poll(() => dialogs.at(-1)).toBe('Görev başlığı boş olamaz. Tarih, etiket gibi ifadelerin yanına bir başlık da yaz.');
    await expect(input).toHaveValue('#acil !1');
  });

  await test.step('ayrıntı butonu ayrıştırılan değerleri forma taşır', async () => {
    await input.fill('haftaya 09:30 sunum !orta #iş');
    await page.getByLabel('Ayrıntılı görev ekle').click();
    await expect(page.getByLabel('Görev başlığı')).toHaveValue('sunum');
    await expect(page.getByLabel('Saat', { exact: true })).toHaveValue('09:30');
    await expect(page.getByLabel('Gelecek hafta', { exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('Öncelik Orta')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('Etiket iş')).toHaveAttribute('aria-checked', 'true');
    await text(page, 'Oluştur').click();
    await expect.poll(() => describeTask(page, 'sunum')).toEqual({
      dueDate: '2026-10-02', dueTime: '09:30', priority: 2, category: 'Gelen Kutusu', tags: ['iş'],
    });
  });

  await test.step('düz metin değişmeden eklenir, önizleme yok', async () => {
    await input.fill('Süt al');
    await expect(preview).toHaveCount(0);
    await input.press('Enter');
    await expect.poll(() => describeTask(page, 'Süt al')).toMatchObject({ dueDate: '2026-09-25', dueTime: null, priority: 0 });
  });
});
