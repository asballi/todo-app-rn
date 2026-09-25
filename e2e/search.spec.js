const { test, expect, openApp, text, record, category, INBOX, taskRecord } = require('./fixtures');

const seed = {
  schemaVersion: 3,
  categories: [INBOX, category('work', 'İş', 'briefcase', '#3cb371', 1), category('home', 'Ev', 'home', '#f08c3a', 2)],
  tags: [
    record('urgent', { name: 'acil', nameKey: 'acil', color: '#e05c5c' }),
    record('phone', { name: 'telefon', nameKey: 'telefon', color: null }),
  ],
  tasks: [
    taskRecord('t1', 'Süt al', { notes: 'Tam yağlı', priority: 1, createdAt: '2026-01-01T00:00:01.000Z' }),
    taskRecord('t2', 'IŞIK faturası', { categoryId: 'home', priority: 3, createdAt: '2026-01-01T00:00:02.000Z' }),
    taskRecord('t3', 'Müşteriyi ara', { categoryId: 'work', priority: 3, createdAt: '2026-01-01T00:00:03.000Z' }),
    taskRecord('t4', 'Rapor yaz', { categoryId: 'work', notes: 'Çeyrek sonu', completedAt: '2026-01-02T00:00:00.000Z' }),
  ],
  taskTags: [
    record('l1', { taskId: 't3', tagId: 'urgent' }),
    record('l2', { taskId: 't3', tagId: 'phone' }),
    record('l3', { taskId: 't2', tagId: 'urgent' }),
  ],
};

// Görünür sonuç satırları (filtre çipleri de checkbox olduğundan ayıklanır).
const results = page =>
  page
    .getByRole('checkbox')
    .filter({ visible: true })
    .evaluateAll(els =>
      els.map(e => e.getAttribute('aria-label')).filter(l => !/^(Etiket|Öncelik|Kategori) /.test(l)),
    );

test('arama: Türkçe karakter duyarsız, filtreler, tamamlananlar ayrı', async ({ page }) => {
  await openApp(page, { path: '/search', seed });
  const query = page.getByLabel('Görevlerde ara');

  await test.step('ölçüt yokken ipucu', async () => {
    await expect(text(page, 'Aramak için yaz veya filtre seç')).toBeVisible();
  });

  await test.step('Türkçe karakter yazmadan, notlarda da arar', async () => {
    await query.fill('sut');
    await expect(text(page, '1 sonuç')).toBeVisible();
    expect(await results(page)).toEqual(['Süt al']);
    await query.fill('ISIK');
    await expect.poll(() => results(page)).toEqual(['IŞIK faturası']);
    await query.fill('yagli');
    await expect.poll(() => results(page)).toEqual(['Süt al']);
  });

  await test.step('temizle ve sonuçsuz arama', async () => {
    await page.getByLabel('Aramayı temizle').click();
    await expect(text(page, 'Aramak için yaz veya filtre seç')).toBeVisible();
    await query.fill('zzz');
    await expect(text(page, 'Sonuç bulunamadı')).toBeVisible();
    await page.getByLabel('Aramayı temizle').click();
  });

  await test.step('kategori filtresi; tamamlanan sonuç katlanmış bölümde', async () => {
    await text(page, 'Filtreler').click();
    await page.getByLabel('Kategori İş').click();
    await expect(text(page, '2 sonuç')).toBeVisible();
    expect(await results(page)).toEqual(['Müşteriyi ara']);
    await expect(text(page, 'Tamamlananlar (1)')).toBeVisible();
  });

  await test.step('etiketler VE mantığıyla', async () => {
    await page.getByLabel('Kategori İş').click();
    await page.getByLabel('Etiket acil').click();
    await expect.poll(() => results(page)).toEqual(['IŞIK faturası', 'Müşteriyi ara']);
    await page.getByLabel('Etiket telefon').click();
    await expect.poll(() => results(page)).toEqual(['Müşteriyi ara']);
    await expect(text(page, 'Filtreler (2)')).toBeVisible();
  });

  await test.step('etiketler "Herhangi biri" modunda VEYA mantığıyla', async () => {
    await page.getByLabel('Etiket eşleşmesi: Herhangi biri').click();
    await expect.poll(() => results(page)).toEqual(['IŞIK faturası', 'Müşteriyi ara']);
    await expect(text(page, 'Filtreler (2)')).toBeVisible(); // mod bir filtre sayılmaz
  });

  await test.step('filtreleri temizle (eşleşme modu da Hepsi\'ne döner)', async () => {
    await text(page, 'Filtreleri temizle').click();
    await expect(text(page, 'Aramak için yaz veya filtre seç')).toBeVisible();
    await expect(page.getByLabel('Etiket eşleşmesi: Hepsi')).toHaveAttribute('aria-checked', 'true');
  });

  await test.step('öncelikler VEYA, sorguyla birlikte', async () => {
    await page.getByLabel('Öncelik Yüksek').click();
    await page.getByLabel('Öncelik Düşük').click();
    await expect.poll(() => results(page)).toEqual(['IŞIK faturası', 'Müşteriyi ara', 'Süt al']);
    await query.fill('ara');
    await expect.poll(() => results(page)).toEqual(['Müşteriyi ara']);
  });

  await test.step('sonuçtan detaya gidip dönünce arama korunur', async () => {
    await text(page, 'Müşteriyi ara').click();
    await expect(page.getByLabel('Görev başlığı')).toHaveValue('Müşteriyi ara');
    await page.goBack();
    await expect(text(page, '1 sonuç')).toBeVisible();
    await expect(query).toHaveValue('ara');
  });

  await test.step('filtrede seçili kategori silinirse filtre düşer', async () => {
    await text(page, 'Filtreleri temizle').click();
    await page.getByLabel('Aramayı temizle').click();
    await page.getByLabel('Kategori Ev').click();
    await expect.poll(() => results(page)).toEqual(['IŞIK faturası']);
    // Uygulama içinde gezinerek sil (sayfa yenilenirse arama durumu zaten sıfırlanır).
    await page.getByRole('tab', { name: 'Listeler' }).click();
    await page.getByText('Ev', { exact: true }).first().click(); // Listeler'deki satır
    await page.getByLabel('Kategoriyi düzenle').click();
    await text(page, 'Kategoriyi sil').click();
    await expect(page.getByLabel('Kategoriyi düzenle')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Ara' }).click();
    await expect(text(page, 'Aramak için yaz veya filtre seç')).toBeVisible();
    await expect(text(page, 'Filtreler')).toBeVisible();
    await expect(page.getByLabel('Kategori Ev')).toHaveCount(0);
  });
});
