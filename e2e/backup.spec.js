const fs = require('fs');
const { test, expect, openApp, text, stored, record, INBOX, taskRecord } = require('./fixtures');

const T = '2026-02-01T00:00:00.000Z';
const deviceA = {
  schemaVersion: 3,
  categories: [INBOX],
  tags: [record('acil', { name: 'acil', nameKey: 'acil', color: null, updatedAt: T })],
  tasks: [
    taskRecord('a1', 'Yedekteki görev', { updatedAt: T }),
    taskRecord('a2', 'Silinmiş görev', { updatedAt: T, deletedAt: T }),
  ],
  taskTags: [record('l1', { taskId: 'a1', tagId: 'acil', updatedAt: T })],
};
const deviceB = {
  schemaVersion: 3,
  categories: [INBOX],
  tags: [],
  tasks: [taskRecord('b1', 'Yerel görev')],
  taskTags: [],
};

async function importFile(page, contents) {
  const chooser = page.waitForEvent('filechooser');
  await text(page, 'İçe aktar').click();
  await (await chooser).setFiles({ name: 'yedek.json', mimeType: 'application/json', buffer: Buffer.from(contents) });
}

test('dışa aktar → başka cihazda içe aktar (birleştir) → geri al', async ({ page, dialogs }) => {
  let exported;

  await test.step('dışa aktar: silinmiş kayıtlar dahil JSON indirilir', async () => {
    await openApp(page, { path: '/settings', seed: deviceA });
    const download = page.waitForEvent('download');
    await text(page, 'Dışa aktar').click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('yapilacaklar-yedek-2026-09-25.json');
    exported = fs.readFileSync(await file.path(), 'utf8');
    const backup = JSON.parse(exported);
    expect(backup).toMatchObject({ app: 'todoapp', schemaVersion: 3 });
    expect(backup.data.tasks.map(t => t.title).sort()).toEqual(['Silinmiş görev', 'Yedekteki görev']);
    expect(backup.data.taskTags).toHaveLength(1);
  });

  await test.step('başka cihazda içe aktar: özet onayı, birleştirme', async () => {
    await openApp(page, { path: '/settings', seed: deviceB });
    await importFile(page, exported);
    await expect.poll(() => dialogs.at(-1)).toBe(
      'Yedek içe aktarılsın mı?\n\n1 görev eklenecek, 1 etiket eklenecek, 1 etiket bağı eklenecek.',
    );
    await expect(text(page, 'Yedek içe aktarıldı')).toBeVisible();
    const tasks = await stored(page, 'tasks');
    expect(tasks.filter(t => !t.deletedAt).map(t => t.title).sort()).toEqual(['Yedekteki görev', 'Yerel görev']);
    expect(tasks.find(t => t.id === 'a2').deletedAt).toBe(T); // silinmiş kayıt silinmiş olarak gelir
  });

  await test.step('aynı yedek tekrar: eklenecek bir şey yok', async () => {
    await importFile(page, exported);
    await expect.poll(() => dialogs.at(-1)).toBe('Bu yedekte eklenecek ya da güncellenecek bir şey yok.');
  });

  await test.step('içe aktarma geri alınabilir', async () => {
    // "Bir şey yok" uyarısı şeridi kapatmaz; yeniden içe aktarıp geri al.
    await openApp(page, { path: '/settings', seed: deviceB });
    await importFile(page, exported);
    await text(page, 'Geri al').click();
    await expect.poll(async () => (await stored(page, 'tasks')).filter(t => !t.deletedAt).map(t => t.title)).toEqual([
      'Yerel görev',
    ]);
  });
});

test('bozuk ve daha yeni sürüm yedek reddedilir, veri değişmez', async ({ page, dialogs }) => {
  await openApp(page, { path: '/settings', seed: deviceB });

  await importFile(page, '{bozuk');
  await expect.poll(() => dialogs.at(-1)).toBe('Bu dosya geçerli bir yedek değil.');

  await importFile(page, JSON.stringify({ app: 'todoapp', schemaVersion: 99, data: {} }));
  await expect.poll(() => dialogs.at(-1)).toBe(
    'Bu yedek uygulamanın daha yeni bir sürümünden alınmış. Önce uygulamayı güncelle.',
  );

  expect((await stored(page, 'tasks')).map(t => t.title)).toEqual(['Yerel görev']);
});
