// Hesap ve senkron (v4): uygulamadaki gerçek supabase-js adaptörü, sahte Supabase
// sunucusuyla (e2e/fakeSupabase.mjs) konuşur. İki cihaz = iki ayrı tarayıcı bağlamı.
const { test, expect, openApp, text, stored, INBOX, taskRecord } = require('./fixtures');

const SUPABASE = `http://localhost:${process.env.E2E_SUPABASE_PORT ?? 8124}`;
const TODAY = '2026-09-25';

let emailSeq = 0;
// Her test kendi hesabını kullanır; sahte sunucu testler arasında paylaşılır.
const newEmail = () => `kullanici${Date.now()}${++emailSeq}@ornek.com`;

const seed = tasks => ({ schemaVersion: 3, categories: [INBOX], tasks, tags: [], taskTags: [] });

async function serverRows(request, email, collection = 'tasks') {
  const response = await request.post(`${SUPABASE}/__admin/rows`, { data: { email, collection } });
  return response.json();
}

const liveTitles = async (request, email) =>
  (await serverRows(request, email)).filter(r => !r.deleted_at).map(r => r.title).sort();

// İkinci cihaz: ayrı bağlam (ayrı localStorage), aynı ayarlar; konsolu da izlenir.
async function secondDevice(browser, consoleErrors) {
  const { baseURL, viewport, timezoneId, locale } = test.info().project.use;
  const context = await browser.newContext({ baseURL, viewport, timezoneId, locale });
  const page = await context.newPage();
  consoleErrors.watch(page);
  page.on('dialog', dialog => dialog.accept());
  return page;
}

async function signIn(page, email) {
  await page.goto('/account');
  await page.getByLabel('E-posta', { exact: true }).fill(email);
  await text(page, 'Kod gönder').click();
  await expect(text(page, `${email} adresine 6 haneli bir kod gönderdik.`)).toBeVisible();
  await page.getByLabel('Kod', { exact: true }).fill('123456');
  await text(page, 'Giriş yap').click();
  await expect(text(page, `Giriş yapılan hesap: ${email}`)).toBeVisible();
}

async function quickAdd(page, title) {
  const input = page.getByPlaceholder('Bugün için görev ekle...');
  await input.fill(title);
  await input.press('Enter');
  await expect(input).toHaveValue('');
}

// Uygulama içinden (sayfa yenilemeden) Hesap ekranına: Listeler → Ayarlar → Hesap
async function openAccountInApp(page) {
  await page.getByRole('tab', { name: /Listeler/ }).click();
  await page.getByLabel('Ayarlar', { exact: true }).click();
  await page.getByRole('button', { name: /^Hesap:/ }).click();
}

test('giriş: yerel görevler hesaba yüklenir, ikinci cihazla birleşir, değişiklik anında geçer', async ({
  page, browser, request, consoleErrors,
}) => {
  const email = newEmail();

  await test.step('A cihazı: girişsiz görev, sonra giriş', async () => {
    await openApp(page, { path: '/settings', seed: seed([taskRecord('a1', 'A görevi', { dueDate: TODAY })]) });
    await expect(text(page, 'Giriş yapılmadı. Görevlerin yalnızca bu cihazda.')).toBeVisible();
    await signIn(page, email);
    await expect.poll(() => liveTitles(request, email)).toEqual(['A görevi']);
    await expect(page.getByText('Eşitlendi.').or(page.getByText(/Son eşitleme: az önce/)).first()).toBeVisible();
  });

  const pageB = await secondDevice(browser, consoleErrors);
  await test.step('B cihazı: kendi görevleriyle giriş, iki taraf birleşir', async () => {
    await openApp(pageB, { path: '/today', seed: seed([taskRecord('b1', 'B görevi', { dueDate: TODAY })]) });
    await signIn(pageB, email);
    await pageB.goto('/today');
    await expect(text(pageB, 'A görevi')).toBeVisible();
    await expect(text(pageB, 'B görevi')).toBeVisible();
    await expect.poll(() => liveTitles(request, email)).toEqual(['A görevi', 'B görevi']);
  });

  await test.step('B\'de eklenen görev A\'da yenilemeden görünür (Realtime)', async () => {
    await page.goto('/today');
    await expect(text(page, 'B görevi')).toBeVisible();
    await quickAdd(pageB, 'Canlı görev');
    await expect(text(page, 'Canlı görev')).toBeVisible({ timeout: 5000 });
  });

  await test.step('A\'da tamamlanan görev B\'de tamamlanır', async () => {
    await page.getByRole('checkbox', { name: /Canlı görev/ }).click();
    await expect.poll(async () => (await stored(pageB, 'tasks')).find(t => t.title === 'Canlı görev')?.completedAt ?? null, {
      timeout: 5000,
    }).not.toBeNull();
  });

  await pageB.context().close();
});

test('çevrimdışı değişiklik bekler, bağlanınca gider; çıkış uyarır ve yerel veriyi siler', async ({
  page, request, dialogs, consoleErrors,
}) => {
  const email = newEmail();
  // Bilinçli çevrimdışı: tarayıcının ağ hata iletileri beklenir.
  consoleErrors.ignore.push(/ERR_INTERNET_DISCONNECTED|Failed to fetch|WebSocket/);

  await openApp(page, { path: '/settings', seed: seed([]) });
  await signIn(page, email);
  await page.goto('/today');
  await quickAdd(page, 'Gönderilen');
  await expect.poll(() => liveTitles(request, email)).toEqual(['Gönderilen']);

  await test.step('çevrimdışı ekle: Hesap ekranında bekleyen değişiklik', async () => {
    await page.context().setOffline(true);
    await quickAdd(page, 'Çevrimdışı');
    await openAccountInApp(page);
    await expect(text(page, '1 değişiklik gönderilmeyi bekliyor.')).toBeVisible({ timeout: 5000 });
    await expect(text(page, 'Sunucuya ulaşılamadı; bağlantı gelince yeniden denenecek.')).toBeVisible();
  });

  await test.step('bağlantı gelince gider', async () => {
    await page.context().setOffline(false);
    await text(page, 'Şimdi eşitle').click();
    await expect.poll(() => liveTitles(request, email)).toEqual(['Gönderilen', 'Çevrimdışı']);
    await expect(text(page, '1 değişiklik gönderilmeyi bekliyor.')).toHaveCount(0);
  });

  await test.step('çevrimdışı çıkış: uyarı onaylanınca yerel veri silinir', async () => {
    await page.context().setOffline(true);
    // Hesap ve Ayarlar pencerelerini kapat (sayfa yenilenmeden, çevrimdışı)
    await page.goBack();
    await page.goBack();
    await page.getByRole('tab', { name: /Bugün/ }).click();
    await quickAdd(page, 'Kaybolacak');
    await openAccountInApp(page);
    await text(page, 'Çıkış yap').click();
    await expect.poll(() => dialogs.at(-1)).toBe(
      'Gönderilmemiş değişiklikler var\n\n1 değişiklik henüz hesaba gönderilmedi. Çıkarsan kaybolacak.',
    );
    await expect(text(page, 'Kod gönder')).toBeVisible();
    await expect.poll(async () => (await stored(page, 'tasks')) ?? []).toEqual([]);
    expect((await stored(page, 'categories')).map(c => c.id)).toEqual(['inbox']);
  });

  await test.step('yeniden giriş: gönderilmiş görevler geri gelir', async () => {
    await page.context().setOffline(false);
    await signIn(page, email);
    await page.goto('/today');
    await expect(text(page, 'Gönderilen')).toBeVisible();
    await expect(text(page, 'Çevrimdışı')).toBeVisible();
    await expect(text(page, 'Kaybolacak')).toHaveCount(0);
  });
});

test('hatalı kod reddedilir; eski sürüm uyarısı; hesabı sil', async ({ page, request, dialogs, consoleErrors }) => {
  const email = newEmail();
  // Hatalı kod (403) ve eski sürüm (400) yanıtlarını tarayıcı konsola yazar.
  consoleErrors.ignore.push(/status of (400|403)/);
  await openApp(page, { path: '/account', seed: seed([]) });

  await test.step('geçersiz e-posta ve hatalı kod', async () => {
    await page.getByLabel('E-posta', { exact: true }).fill('gecersiz');
    await text(page, 'Kod gönder').click();
    await expect(text(page, 'Geçerli bir e-posta adresi yaz.')).toBeVisible();
    await page.getByLabel('E-posta', { exact: true }).fill(email);
    await text(page, 'Kod gönder').click();
    await expect(page.getByText(/Yeniden göndermek için \d+ sn/)).toBeVisible();
    await page.getByLabel('Kod', { exact: true }).fill('000000');
    await text(page, 'Giriş yap').click();
    await expect(text(page, 'Kod hatalı ya da süresi geçmiş.')).toBeVisible();
    await page.getByLabel('Kod', { exact: true }).fill('123456');
    await text(page, 'Giriş yap').click();
    await expect(text(page, `Giriş yapılan hesap: ${email}`)).toBeVisible();
  });

  await test.step('sunucu daha yeni sürüm isteyince şerit ve uyarı; düzelince eşitlenir', async () => {
    await request.post(`${SUPABASE}/__admin/min-schema`, { data: { version: 4 } });
    try {
      await text(page, 'Şimdi eşitle').click();
      await expect(text(page, 'Senkronizasyon için uygulamayı güncelle.')).toBeVisible();
      await expect(text(page, 'Senkronizasyon için uygulamayı güncelle. Değişikliklerin bu cihazda saklanıyor.')).toBeVisible();
    } finally {
      await request.post(`${SUPABASE}/__admin/min-schema`, { data: { version: 3 } });
    }
    await text(page, 'Şimdi eşitle').click();
    await expect(text(page, 'Senkronizasyon için uygulamayı güncelle. Değişikliklerin bu cihazda saklanıyor.')).toHaveCount(0);
  });

  await test.step('hesabı sil: iki onay, sunucu ve yerel veri silinir', async () => {
    await page.goto('/today');
    await quickAdd(page, 'Silinecek');
    await expect.poll(() => liveTitles(request, email)).toEqual(['Silinecek']);
    await page.goto('/account');
    await text(page, 'Hesabı sil').click();
    await expect(text(page, 'Kod gönder')).toBeVisible();
    expect(dialogs.slice(-2).map(m => m.split('\n')[0])).toEqual(['Hesap silinsin mi?', 'Emin misin?']);
    expect(await serverRows(request, email)).toEqual([]);
    await expect.poll(async () => (await stored(page, 'tasks')) ?? []).toEqual([]);
  });
});
