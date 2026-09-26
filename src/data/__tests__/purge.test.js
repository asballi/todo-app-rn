import { expiredIds } from '../purge';

const NOW = new Date('2026-09-25T10:00:00Z');
const rec = (id, deletedAt) => ({ id, deletedAt });

test('yalnızca 30 günden eski silinmiş kayıtları seçer', () => {
  const records = [
    rec('alive', null),
    rec('old', '2026-08-25T09:59:59.999Z'),
    rec('edge', '2026-08-26T10:00:00.000Z'), // tam 30 gün: kalır
    rec('recent', '2026-09-20T00:00:00.000Z'),
  ];
  expect(expiredIds(records, NOW)).toEqual(['old']);
});

test('keep ile işaretlenenler kalır', () => {
  const records = [rec('a', '2026-01-01T00:00:00Z'), rec('b', '2026-01-01T00:00:00Z')];
  expect(expiredIds(records, NOW, id => id === 'a')).toEqual(['b']);
});
