// Senkron yapılandırması (.env, depoya girmez; örnek: .env.example).
// Expo, EXPO_PUBLIC_ ile başlayan değişkenleri derleme sırasında koda yazar;
// bu yüzden process.env.X biçiminde tek tek okunmaları gerekir.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export const syncConfig = {
  supabaseUrl,
  supabaseKey,
  // Yapılandırma yoksa hesap bölümü "Yapılandırılmadı" der, uygulama yerel çalışır.
  enabled: Boolean(supabaseUrl && supabaseKey),
};
