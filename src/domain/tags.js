import { turkishLower } from './text';

// Etiket adlarının benzersizlik anahtarı: Türkçe kurallarla küçük harf.
export function tagKey(name) {
  return turkishLower(name.trim());
}
