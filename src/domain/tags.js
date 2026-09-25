// Etiket adlarının benzersizlik anahtarı. toLocaleLowerCase('tr-TR') yerine
// elle yapılır, çünkü her JS motoru yerel ayarlı dönüşümü desteklemez.
// Türkçe kuralı: I → ı, İ → i.
export function tagKey(name) {
  return name.trim().replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
}
