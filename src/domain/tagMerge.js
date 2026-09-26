import { liveRecords, softDelete, createTaskTag } from './models';

// Aynı ada (nameKey) sahip canlı etiketleri birleştirir (X14). Senkronda iki cihaz
// çevrimdışıyken aynı etiketi ayrı ayrı oluşturduğunda ortaya çıkar.
// Kural belirleyicidir, böylece her cihaz aynı sonuca varır:
//   - createdAt'ı en eski olan kalır (eşitlikte küçük id); adı ve rengi onunkidir.
//   - Diğerleri silinir; bağları silinip kalan etikete türetilmiş kimlikle yeniden
//     kurulur (görev zaten ona bağlıysa yalnızca silinir).
// Dönüş: { tags, taskTags } değişen kayıtlar; kopya yoksa ikisi de boş.
export function mergeDuplicateTags({ tags, taskTags }, now = new Date()) {
  const groups = new Map();
  for (const tag of liveRecords(tags)) {
    groups.set(tag.nameKey, [...(groups.get(tag.nameKey) ?? []), tag]);
  }

  const survivorOf = new Map();
  const changedTags = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [survivor, ...duplicates] = [...group].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
    for (const tag of duplicates) {
      survivorOf.set(tag.id, survivor.id);
      changedTags.push(softDelete(tag, now));
    }
  }
  if (changedTags.length === 0) return { tags: [], taskTags: [] };

  const liveLinks = liveRecords(taskTags);
  const linked = new Set(liveLinks.map(l => `${l.taskId}|${l.tagId}`));
  const changedLinks = [];
  for (const link of liveLinks) {
    const survivorId = survivorOf.get(link.tagId);
    if (!survivorId) continue;
    changedLinks.push(softDelete(link, now));
    const key = `${link.taskId}|${survivorId}`;
    if (linked.has(key)) continue;
    linked.add(key);
    changedLinks.push(createTaskTag(link.taskId, survivorId, now));
  }
  return { tags: changedTags, taskTags: changedLinks };
}
