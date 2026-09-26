import { createHash } from 'crypto';
import { uuidV5, nextOccurrenceId, taskTagId, newId } from '../ids';
import { sha1, utf8Bytes } from '../sha1';

const hex = bytes => Buffer.from(bytes).toString('hex');

test('sha1 Node ile aynı özeti verir', () => {
  const samples = ['', 'abc', 'Çiçek sula ğüşıöİ', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), '😀 emoji', 'a'.repeat(1000)];
  for (const text of samples) {
    expect(hex(sha1(utf8Bytes(text)))).toBe(createHash('sha1').update(text, 'utf8').digest('hex'));
  }
});

test('utf8Bytes Buffer ile aynı baytları verir', () => {
  const text = 'aç€😀İ';
  expect(utf8Bytes(text)).toEqual([...Buffer.from(text, 'utf8')]);
});

test('uuidV5 RFC 4122 örneğini üretir', () => {
  // DNS ad alanı + "www.example.com" (Python uuid.uuid5 ile aynı)
  expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
});

test('türetilen kimlikler belirleyici ve birbirinden farklı', () => {
  const task = newId();
  const tag = newId();
  expect(nextOccurrenceId(task)).toBe(nextOccurrenceId(task));
  expect(nextOccurrenceId(task)).not.toBe(nextOccurrenceId(newId()));
  expect(taskTagId(task, tag)).toBe(taskTagId(task, tag));
  expect(taskTagId(task, tag)).not.toBe(taskTagId(tag, task));
  expect(nextOccurrenceId(task)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
