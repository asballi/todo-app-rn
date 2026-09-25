// Ortak test yardımcıları.
// - Her test sonunda konsol hatası / sayfa hatası olmadığı doğrulanır.
// - Tarayıcı iletişim kutuları (confirm/alert) kabul edilir ve `dialogs` içinde tutulur.
const base = require('@playwright/test');

// Cuma 25 Eylül 2026, 10:00 (İstanbul) — tarihe bağlı testlerin sabit "şimdi"si.
const NOW = new Date('2026-09-25T10:00:00+03:00');

const test = base.test.extend({
  // Her testte etkin: aksi halde Playwright iletişim kutularını reddeder ve
  // onay bekleyen işlemler (ör. kategori silme) sessizce gerçekleşmez.
  dialogs: [
    async ({ page }, use) => {
      const messages = [];
      page.on('dialog', dialog => {
        messages.push(dialog.message());
        dialog.accept();
      });
      await use(messages);
    },
    { auto: true },
  ],
  consoleErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => ['error', 'warning'].includes(m.type()) && errors.push(`${m.type()}: ${m.text()}`));
      await use(errors);
      base.expect(errors, 'konsol hatası olmamalı').toEqual([]);
    },
    { auto: true },
  ],
});

// Uygulamayı boş (ya da verilen) veriyle açar. seed: { schemaVersion, tasks, ... }
async function openApp(page, { path = '/today', seed = null, clock = true } = {}) {
  if (clock) await page.clock.install({ time: NOW });
  await page.goto('/today');
  await page.evaluate(seedData => {
    localStorage.clear();
    if (!seedData) return;
    for (const [key, value] of Object.entries(seedData)) {
      localStorage.setItem(key === 'legacyTodos' ? '@todos' : `@todo/${key}`, JSON.stringify(value));
    }
  }, seed);
  await page.goto(path);
  // Veriler yüklenip taşındığında yükleme göstergesi kaybolur (modal ekranlarda sekme çubuğu yoktur).
  await page.waitForFunction(() => localStorage.getItem('@todo/schemaVersion') === '3');
  await base.expect(page.getByRole('progressbar')).toHaveCount(0);
}

// Tam eşleşen, en son eklenen metin (gizli sekmeler DOM'da kalabilir).
const text = (page, value) => page.getByText(value, { exact: true }).last();

const stored = (page, collection) =>
  page.evaluate(key => JSON.parse(localStorage.getItem(`@todo/${key}`) ?? 'null'), collection);

const liveTask = async (page, title) =>
  (await stored(page, 'tasks')).find(t => t.title === title && !t.deletedAt);

// Hazır veri parçaları
const TS = '2026-01-01T00:00:00.000Z';
const record = (id, fields) => ({ id, createdAt: TS, updatedAt: TS, deletedAt: null, ...fields });
const category = (id, name, icon, color, sortOrder, isSystem = false) =>
  record(id, { name, icon, color, sortOrder, isSystem });
const INBOX = category('inbox', 'Gelen Kutusu', 'inbox', '#6c63ff', 0, true);
const taskRecord = (id, title, fields = {}) =>
  record(id, {
    title, notes: '', categoryId: 'inbox', dueDate: null, dueTime: null, priority: 0, completedAt: null,
    reminders: [], recurrence: null, nextTaskId: null, checklist: [], ...fields,
  });

module.exports = {
  test,
  expect: base.expect,
  NOW,
  openApp,
  text,
  stored,
  liveTask,
  record,
  category,
  INBOX,
  taskRecord,
};
