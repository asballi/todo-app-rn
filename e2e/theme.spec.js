const { test, expect, openApp, stored } = require('./fixtures');

// Sayfa zemini ve tarayıcı denetimlerinin renk şeması (ThemeProvider web'de ayarlar).
const pageTheme = page =>
  page.evaluate(() => ({
    background: document.body.style.backgroundColor,
    colorScheme: document.documentElement.style.colorScheme,
  }));
const LIGHT = { background: 'rgb(236, 235, 255)', colorScheme: 'light' };
const DARK = { background: 'rgb(18, 18, 24)', colorScheme: 'dark' };

test('Sistem teması tarayıcının açık/koyu tercihini canlı izler', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openApp(page);
  await expect.poll(() => pageTheme(page)).toEqual(DARK);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => pageTheme(page)).toEqual(LIGHT);
});

test('Ayarlar: seçilen tema sistem tercihini ezer ve kalıcıdır', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openApp(page, { path: '/settings' });

  const option = name => page.getByRole('radio', { name, exact: true });
  await expect(option('Sistem')).toHaveAttribute('aria-checked', 'true');

  await test.step('Koyu seçilince uygulama koyu olur ve kaydedilir', async () => {
    await option('Koyu').click();
    await expect(option('Koyu')).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => pageTheme(page)).toEqual(DARK);
    expect((await stored(page, 'settings')).theme).toBe('dark');
  });

  await test.step('yeniden açılınca koyu kalır', async () => {
    await page.reload();
    await expect(option('Koyu')).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => pageTheme(page)).toEqual(DARK);
  });

  await test.step('Açık, koyu sistem tercihine rağmen açık kalır', async () => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await option('Açık').click();
    await expect.poll(() => pageTheme(page)).toEqual(LIGHT);
  });

  await test.step('Sistem\'e dönünce yine tarayıcıyı izler', async () => {
    await option('Sistem').click();
    await expect.poll(() => pageTheme(page)).toEqual(DARK);
    expect((await stored(page, 'settings')).theme).toBe('system');
  });
});
