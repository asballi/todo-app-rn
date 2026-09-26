const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { openDb, make } = require('./db');

let db;
before(async () => { db = await openDb(__filename); });
after(async () => { await db.close(); });

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Pull imlecinin kayıt atlamaması için: aynı kullanıcının ikinci yazması, ilki
// commit edilene kadar bekler ve daha büyük server_seq alır.
test('aynı kullanıcının eşzamanlı yazmaları sıraya girer', async () => {
  const user = await db.newUser();
  const c1 = await db.connect();
  const c2 = await db.connect();
  const first = make.task({ title: 'ilk' });
  const second = make.task({ title: 'ikinci' });

  let release;
  const gate = new Promise(r => { release = r; });
  const tx1 = db.asUser(user, async q => {
    await q('select public.push(3, $1)', [{ tasks: [first] }]);
    await gate; // commit etmeden bekle
  }, c1);
  await sleep(100);

  let secondDone = false;
  const tx2 = db.asUser(user, q => q('select public.push(3, $1)', [{ tasks: [second] }]), c2)
    .then(() => { secondDone = true; });
  await sleep(300);
  assert.equal(secondDone, false, 'ikinci yazma kilitte beklemeli');

  // Bu anda çeken bir cihaz commit edilmemiş hiçbir şeyi görmez.
  assert.deepEqual((await db.pull(user)).records, []);

  release();
  await tx1;
  await tx2;
  const { records } = await db.pull(user);
  assert.deepEqual(records.map(r => r.record.title), ['ilk', 'ikinci']);
});

test('farklı kullanıcılar birbirini beklemez', async () => {
  const alice = await db.newUser();
  const bob = await db.newUser();
  const c1 = await db.connect();
  const c2 = await db.connect();

  let release;
  const gate = new Promise(r => { release = r; });
  const tx1 = db.asUser(alice, async q => {
    await q('select public.push(3, $1)', [{ tasks: [make.task()] }]);
    await gate;
  }, c1);
  await sleep(100);
  await db.asUser(bob, q => q('select public.push(3, $1)', [{ tasks: [make.task()] }]), c2);
  release();
  await tx1;
});
