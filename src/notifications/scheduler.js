// Kurulu bildirimleri planla eşitler: plandaki anahtarı olmayan (eski,
// değişmiş, çift) bildirimler iptal edilir, eksikler kurulur.
// adapter: { canSchedule(), listScheduled() → [{ id, key }], schedule(item), cancel(id) }
export async function syncNotifications(adapter, planned) {
  const wanted = (await adapter.canSchedule()) ? planned : [];
  const wantedKeys = new Set(wanted.map(p => p.key));
  const kept = new Set();
  let cancelled = 0;
  for (const item of await adapter.listScheduled()) {
    if (wantedKeys.has(item.key) && !kept.has(item.key)) {
      kept.add(item.key);
    } else {
      await adapter.cancel(item.id);
      cancelled += 1;
    }
  }
  let scheduled = 0;
  for (const item of wanted) {
    if (kept.has(item.key)) continue;
    await adapter.schedule(item);
    scheduled += 1;
  }
  return { scheduled, cancelled };
}

// Eşitlemeleri sıraya koyar; çalışırken gelen istekler birleştirilir ve
// yalnızca en son plan uygulanır.
export function createSyncer(adapter) {
  let running = null;
  let pending = null;

  async function drain() {
    while (pending) {
      const planned = pending;
      pending = null;
      try {
        await syncNotifications(adapter, planned);
      } catch (e) {
        console.warn('Bildirimler eşitlenemedi', e);
      }
    }
    running = null;
  }

  return function sync(planned) {
    pending = planned;
    if (!running) running = drain();
    return running;
  };
}
