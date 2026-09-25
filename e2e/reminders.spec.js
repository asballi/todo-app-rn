const { test, expect, openApp, text, stored } = require('./fixtures');

// Headless Chromium bildirim iznini her zaman "denied" bildirir. Gerçek
// Notification yerine izni ayarlanabilen ve gösterilenleri kaydeden sahte sınıf.
async function fakeNotifications(page, { permission, requestResult = permission }) {
  await page.addInitScript(([initial, result]) => {
    window.__shown = [];
    window.__requested = 0;
    class FakeNotification {
      static permission = initial;
      static async requestPermission() {
        window.__requested += 1;
        FakeNotification.permission = result;
        return result;
      }
      constructor(title, options) {
        window.__shown.push({ title, body: options.body });
      }
      close() {}
    }
    window.Notification = FakeNotification;
  }, [permission, requestResult]);
}

async function createTask(page, title, { time, reminders }) {
  await page.goto('/task/new?dueDate=2026-09-25');
  await page.getByLabel('Görev başlığı').fill(title);
  if (time) {
    await page.getByLabel('Saat ekle').click();
    await page.getByLabel('Saat', { exact: true }).fill(time);
  }
  for (const r of reminders) await page.getByLabel(r, { exact: true }).click();
  await text(page, 'Oluştur').click();
  await expect(text(page, title)).toBeVisible();
}

// Uygulama içi hatırlatıcı şeridi (geri alma şeridi de role=alert kullanır).
const banner = (page, title) => page.getByLabel(`${title} görevini aç`);

test('izin verilmiş: ayarlar, seçici sınırları, şerit, arka plan bildirimi, tamamlananlar çalmaz', async ({ page }) => {
  await fakeNotifications(page, { permission: 'granted' });
  await openApp(page);

  await test.step('Ayarlar: izin durumu ve varsayılan hatırlatma saati', async () => {
    await page.getByRole('tab', { name: 'Listeler' }).click();
    await page.getByLabel('Ayarlar').click();
    await expect(text(page, 'Bildirim izni verildi.')).toBeVisible();
    await page.getByLabel('Saat', { exact: true }).fill('08:00');
    await expect.poll(() => stored(page, 'settings')).toEqual({ defaultReminderTime: '08:00' });
  });

  await test.step('seçici: en fazla 3; saatsiz görevde varsayılan saat notu', async () => {
    await page.goto('/task/new?dueDate=2026-09-26');
    for (const r of ['Zamanında', '10 dk önce', '30 dk önce', '1 saat önce']) {
      await page.getByLabel(r, { exact: true }).click();
    }
    const checked = await page.getByRole('checkbox', { checked: true }).evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
    expect(checked).toEqual(['Zamanında', '10 dk önce', '30 dk önce']);
    await expect(text(page, 'En fazla 3 hatırlatıcı')).toBeVisible();
    await expect(text(page, 'Saat seçilmedi: hatırlatıcılar varsayılan saate (08:00) göre ayarlanır.')).toBeVisible();
  });

  await test.step('görünür sekmede zamanı gelince şerit; dokununca görev açılır', async () => {
    await createTask(page, 'Toplantı', { time: '10:30', reminders: ['Zamanında'] });
    await expect(page.getByLabel('1 hatırlatıcı')).toHaveCount(1);
    await page.clock.runFor(29 * 60 * 1000);
    await expect(banner(page, 'Toplantı')).toHaveCount(0);
    await page.clock.runFor(2 * 60 * 1000);
    await expect(banner(page, 'Toplantı')).toBeVisible();
    await expect(page.getByText('Bugün 10:30').first()).toBeVisible();
    await banner(page, 'Toplantı').click();
    await expect(page.getByLabel('Görev başlığı')).toHaveValue('Toplantı');
    await expect(banner(page, 'Toplantı')).toHaveCount(0);
  });

  await test.step('arka plandaki sekmede tarayıcı bildirimi, şerit yok', async () => {
    await createTask(page, 'Arama yap', { time: '11:00', reminders: ['Zamanında'] });
    await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }));
    await page.clock.runFor(31 * 60 * 1000);
    await expect.poll(() => page.evaluate(() => window.__shown)).toEqual([{ title: 'Arama yap', body: 'Bugün 11:00' }]);
    await expect(banner(page, 'Arama yap')).toHaveCount(0);
    await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }));
  });

  await test.step('tamamlanan görevin hatırlatıcısı çalmaz', async () => {
    await createTask(page, 'İptal edilecek', { time: '12:00', reminders: ['Zamanında'] });
    await page.getByRole('checkbox', { name: 'İptal edilecek' }).click();
    await page.clock.runFor(1000);
    await page.clock.runFor(61 * 60 * 1000);
    await expect(banner(page, 'İptal edilecek')).toHaveCount(0);
    expect(await page.evaluate(() => window.__shown)).toEqual([]);
  });
});

test('izin reddedilirse: bir kez istenir, uyarı görünür, hatırlatıcılar yine kaydedilir', async ({ page }) => {
  await fakeNotifications(page, { permission: 'default', requestResult: 'denied' });
  await openApp(page, { path: '/task/new?dueDate=2026-09-26' });
  await page.getByLabel('Görev başlığı').fill('Reddedilen');
  await expect(page.getByText(/Bildirim izni kapalı/)).toHaveCount(0);
  await page.getByLabel('Zamanında', { exact: true }).click();
  await expect(page.getByText(/Bildirim izni kapalı/)).toBeVisible();
  await page.getByLabel('1 saat önce', { exact: true }).click();
  expect(await page.evaluate(() => window.__requested)).toBe(1);
  await text(page, 'Oluştur').click();
  await expect.poll(async () => (await stored(page, 'tasks'))?.find(t => t.title === 'Reddedilen')?.reminders).toEqual([0, 60]);
});

test('Ayarlar: henüz istenmemiş izin butonla istenir', async ({ page }) => {
  await fakeNotifications(page, { permission: 'default', requestResult: 'granted' });
  await openApp(page, { path: '/settings' });
  await expect(text(page, 'Bildirim izni henüz istenmedi.')).toBeVisible();
  await text(page, 'Bildirimlere izin ver').click();
  await expect(text(page, 'Bildirim izni verildi.')).toBeVisible();
});
