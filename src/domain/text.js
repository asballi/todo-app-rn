// Türkçe küçük harfe çevirme. toLocaleLowerCase('tr-TR') yerine elle yapılır,
// çünkü her JS motoru yerel ayarlı dönüşümü desteklemez. I → ı, İ → i.
export function turkishLower(text) {
  return text.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
}

const FOLD = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

// Arama için: büyük/küçük harf ve Türkçe karakter farkını yok sayar
// ("sut" → "Süt", "ISIK" → "ışık").
export function foldForSearch(text) {
  return turkishLower(text).replace(/[çğıöşü]/g, ch => FOLD[ch]);
}
