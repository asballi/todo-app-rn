import { searchTasks, hasSearchCriteria } from '../filters';
import { foldForSearch } from '../text';
import { tagKey } from '../tags';

let seq = 0;
const task = (title, fields = {}) => ({
  id: `t${++seq}`,
  title,
  notes: '',
  categoryId: 'inbox',
  dueDate: null,
  dueTime: null,
  priority: 0,
  completedAt: null,
  deletedAt: null,
  createdAt: `2026-01-01T00:00:${String(seq).padStart(2, '0')}.000Z`,
  ...fields,
});
const link = (taskId, tagId, fields = {}) => ({ id: `${taskId}-${tagId}`, taskId, tagId, deletedAt: null, ...fields });
const titles = list => list.map(t => t.title);

const milk = task('Süt al', { notes: 'Tam yağlı', priority: 1 });
const light = task('IŞIK faturası', { categoryId: 'home', priority: 3 });
const call = task('Müşteriyi ara', { categoryId: 'work', priority: 3 });
const report = task('Rapor yaz', { categoryId: 'work', notes: 'Çeyrek sonu', completedAt: 'x' });
const gone = task('Silinmiş süt', { deletedAt: 'x' });
const tasks = [milk, light, call, report, gone];
const links = [
  link(call.id, 'urgent'),
  link(call.id, 'phone'),
  link(light.id, 'urgent'),
  link(report.id, 'phone', { deletedAt: 'x' }),
];

test('foldForSearch Türkçe karakter ve büyük/küçük harf farkını yok sayar', () => {
  expect(foldForSearch('IŞIK Çeyrek Ğ Ü Ö İ')).toBe('isik ceyrek g u o i');
});

test('tagKey eski davranışını korur (Türkçe karakterleri silmez)', () => {
  expect(tagKey(' IŞIK ')).toBe('ışık');
});

describe('sorgu', () => {
  test('Türkçe karakter yazmadan bulur', () => {
    expect(titles(searchTasks(tasks, links, { query: 'sut' }))).toEqual(['Süt al']);
    expect(titles(searchTasks(tasks, links, { query: 'isik' }))).toEqual(['IŞIK faturası']);
  });

  test('notlarda da arar', () => {
    expect(titles(searchTasks(tasks, links, { query: 'yagli' }))).toEqual(['Süt al']);
    expect(titles(searchTasks(tasks, links, { query: 'ÇEYREK' }))).toEqual(['Rapor yaz']);
  });

  test('her kelime geçmeli, sıra önemsiz', () => {
    expect(titles(searchTasks(tasks, links, { query: 'al süt' }))).toEqual(['Süt al']);
    expect(searchTasks(tasks, links, { query: 'süt rapor' })).toEqual([]);
  });

  test('silinmiş görevler çıkmaz, tamamlananlar çıkar', () => {
    expect(titles(searchTasks(tasks, links, { query: 'süt' }))).toEqual(['Süt al']);
    expect(titles(searchTasks(tasks, links, { query: 'rapor' }))).toEqual(['Rapor yaz']);
  });
});

describe('filtreler', () => {
  test('kategori', () => {
    expect(titles(searchTasks(tasks, links, { categoryId: 'work' }))).toEqual(['Müşteriyi ara', 'Rapor yaz']);
  });

  test('etiketler VE mantığıyla, silinmiş bağlar sayılmaz', () => {
    expect(titles(searchTasks(tasks, links, { tagIds: ['urgent'] }))).toEqual(['IŞIK faturası', 'Müşteriyi ara']);
    expect(titles(searchTasks(tasks, links, { tagIds: ['urgent', 'phone'] }))).toEqual(['Müşteriyi ara']);
    expect(titles(searchTasks(tasks, links, { tagIds: ['phone'] }))).toEqual(['Müşteriyi ara']);
  });

  test('öncelikler VEYA mantığıyla', () => {
    expect(titles(searchTasks(tasks, links, { priorities: [1, 3] }))).toEqual(['IŞIK faturası', 'Müşteriyi ara', 'Süt al']);
  });

  test('sorgu ve filtreler birlikte', () => {
    expect(titles(searchTasks(tasks, links, { query: 'ara', categoryId: 'work', tagIds: ['phone'], priorities: [3] })))
      .toEqual(['Müşteriyi ara']);
    expect(searchTasks(tasks, links, { query: 'ara', categoryId: 'home' })).toEqual([]);
  });
});

test('hasSearchCriteria', () => {
  expect(hasSearchCriteria({ query: '   ' })).toBe(false);
  expect(hasSearchCriteria({ query: 'a' })).toBe(true);
  expect(hasSearchCriteria({ categoryId: 'inbox' })).toBe(true);
  expect(hasSearchCriteria({ tagIds: ['x'] })).toBe(true);
  expect(hasSearchCriteria({ priorities: [0] })).toBe(true);
});
