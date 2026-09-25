import { todayView, upcomingView, overdueTasks, splitCompleted } from '../filters';

// Cuma 25 Eylül 2026, 10:00 (yerel saat)
const NOW = new Date(2026, 8, 25, 10, 0);

let seq = 0;
const task = (title, fields = {}) => ({
  id: `id-${++seq}`,
  title,
  categoryId: 'inbox',
  dueDate: null,
  dueTime: null,
  priority: 0,
  completedAt: null,
  deletedAt: null,
  createdAt: `2026-01-01T00:00:${String(seq).padStart(2, '0')}.000Z`,
  ...fields,
});
const titles = list => list.map(t => t.title);
const completedToday = new Date(2026, 8, 25, 9, 0).toISOString();
const completedYesterday = new Date(2026, 8, 24, 9, 0).toISOString();

describe('todayView', () => {
  const tasks = [
    task('dün', { dueDate: '2026-09-24' }),
    task('bugün 09:00 (geçti)', { dueDate: '2026-09-25', dueTime: '09:00' }),
    task('bugün 15:00', { dueDate: '2026-09-25', dueTime: '15:00' }),
    task('bugün saatsiz', { dueDate: '2026-09-25', priority: 3 }),
    task('yarın', { dueDate: '2026-09-26' }),
    task('tarihsiz'),
    task('silinmiş', { dueDate: '2026-09-25', deletedAt: 'x' }),
    task('bugün bitti', { dueDate: '2026-09-25', completedAt: completedToday }),
    task('gecikmişti, bugün bitti', { dueDate: '2026-09-20', completedAt: completedToday }),
    task('dün bitti', { dueDate: '2026-09-25', completedAt: completedYesterday }),
    task('gelecek hafta, bugün bitti', { dueDate: '2026-10-02', completedAt: completedToday }),
    task('tarihsiz, bugün bitti', { completedAt: completedToday }),
  ];
  const view = todayView(tasks, NOW);

  test('gecikmişler: önceki günler ve saati geçmiş bugünkü görevler', () => {
    expect(titles(view.overdue)).toEqual(['dün', 'bugün 09:00 (geçti)']);
  });

  test('bugün: saatliler önce, sonra saatsizler', () => {
    expect(titles(view.today)).toEqual(['bugün 15:00', 'bugün saatsiz']);
  });

  test('tamamlananlar: yalnızca bugün tamamlanan ve Bugün listesine ait olanlar', () => {
    expect(titles(view.completed).sort()).toEqual(['bugün bitti', 'gecikmişti, bugün bitti'].sort());
  });
});

describe('upcomingView', () => {
  const tasks = [
    task('bugün', { dueDate: '2026-09-25' }),
    task('yarın', { dueDate: '2026-09-26' }),
    task('yarın 08:00', { dueDate: '2026-09-26', dueTime: '08:00' }),
    task('7. gün', { dueDate: '2026-10-02' }),
    task('8. gün', { dueDate: '2026-10-03' }),
    task('3. gün bitti', { dueDate: '2026-09-28', completedAt: completedToday }),
  ];
  const view = upcomingView(tasks, NOW);

  test('yarından başlayan 7 gün, boş günler dahil', () => {
    expect(view.days.map(d => d.date)).toEqual([
      '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02',
    ]);
    expect(view.days[1].tasks).toEqual([]);
  });

  test('görevler kendi günlerinde ve sıralı', () => {
    expect(titles(view.days[0].tasks)).toEqual(['yarın 08:00', 'yarın']);
    expect(titles(view.days[6].tasks)).toEqual(['7. gün']);
  });

  test('aralık dışı görevler yok, tamamlananlar ayrı', () => {
    const all = view.days.flatMap(d => titles(d.tasks));
    expect(all).not.toContain('bugün');
    expect(all).not.toContain('8. gün');
    expect(titles(view.completed)).toEqual(['3. gün bitti']);
  });

  test('ay sonu ve yaz saati geçişini aşar', () => {
    const march = upcomingView([], new Date(2026, 2, 6, 12, 0));
    expect(march.days.map(d => d.date)).toEqual([
      '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13',
    ]);
  });
});

test('overdueTasks yalnızca açık, canlı ve gecikmiş görevler', () => {
  const tasks = [
    task('gecikmiş', { dueDate: '2026-09-20' }),
    task('gecikmiş ama bitti', { dueDate: '2026-09-20', completedAt: completedToday }),
    task('gecikmiş ama silindi', { dueDate: '2026-09-20', deletedAt: 'x' }),
    task('bugün', { dueDate: '2026-09-25' }),
  ];
  expect(titles(overdueTasks(tasks, NOW))).toEqual(['gecikmiş']);
});

test('splitCompleted sırayı koruyarak ayırır', () => {
  const tasks = [task('a'), task('b', { completedAt: 'x' }), task('c'), task('d', { completedAt: 'x' })];
  const { open, completed } = splitCompleted(tasks);
  expect(titles(open)).toEqual(['a', 'c']);
  expect(titles(completed)).toEqual(['b', 'd']);
});
