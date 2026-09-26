const { test, expect, openApp, text, liveTask, INBOX, taskRecord } = require('./fixtures');

const seed = {
  schemaVersion: 3,
  categories: [INBOX],
  tags: [],
  taskTags: [],
  tasks: [
    taskRecord('a', 'Kitap oku', { dueDate: '2026-09-25' }),
    taskRecord('b', 'Süt al', { dueDate: '2026-09-25' }),
  ],
};
const deleteButton = (page, title) => page.getByRole('button', { name: `"${title}" görevini sil` });
const row = (page, title) => page.getByRole('checkbox', { name: title }).locator('..');

test('web: üzerine gelince sil butonu; klavyeyle de erişilir; geri alınabilir', async ({ page }) => {
  await openApp(page, { seed });

  await test.step('buton yalnızca fare üzerindeyken görünür ve tıklanabilir', async () => {
    await expect(deleteButton(page, 'Kitap oku')).toHaveCSS('opacity', '0');
    await expect(deleteButton(page, 'Kitap oku')).toHaveCSS('pointer-events', 'none');
    await row(page, 'Kitap oku').hover();
    await expect(deleteButton(page, 'Kitap oku')).toHaveCSS('opacity', '1');
    await expect(deleteButton(page, 'Süt al')).toHaveCSS('opacity', '0');
    await page.mouse.move(0, 0);
    await expect(deleteButton(page, 'Kitap oku')).toHaveCSS('opacity', '0');
  });

  await test.step('tıklayınca onay sormadan silinir, geri alınır', async () => {
    await row(page, 'Kitap oku').hover();
    await deleteButton(page, 'Kitap oku').click();
    await expect(page.getByRole('checkbox', { name: 'Kitap oku' })).toHaveCount(0);
    await expect(text(page, 'Görev silindi')).toBeVisible();
    expect(await liveTask(page, 'Kitap oku')).toBeUndefined();
    await text(page, 'Geri al').click();
    await expect(page.getByRole('checkbox', { name: 'Kitap oku' })).toBeVisible();
    expect(await liveTask(page, 'Kitap oku')).toBeTruthy();
  });

  await test.step('klavye: odaklanınca görünür, Enter siler', async () => {
    await deleteButton(page, 'Süt al').focus();
    await expect(deleteButton(page, 'Süt al')).toHaveCSS('opacity', '1');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('checkbox', { name: 'Süt al' })).toHaveCount(0);
    expect(await liveTask(page, 'Süt al')).toBeUndefined();
  });
});

test.describe('dokunmatik', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 400, height: 800 } });

  test('görünmez butonun yerine dokunmak silmez, görevi açar', async ({ page }) => {
    await openApp(page, { seed });
    const box = await deleteButton(page, 'Kitap oku').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(/\/task\/a$/);
    expect(await liveTask(page, 'Kitap oku')).toBeTruthy();
  });
});
