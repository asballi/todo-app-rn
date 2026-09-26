// Görev satırında kaydırma kararı (plan W7). Satır genişliğinin bu oranı
// kadar kaydırılıp bırakılınca işlem yapılır; daha azında satır geri döner.
export const SWIPE_RATIO = 1 / 3;

// translationX > 0: sağa (tamamla / geri aç), < 0: sola (sil).
// Hareket işleyicisinde UI iş parçacığında çalışır.
export function swipeAction(translationX, width) {
  'worklet';
  if (!(width > 0)) return null;
  const threshold = width * SWIPE_RATIO;
  if (translationX >= threshold) return 'complete';
  if (translationX <= -threshold) return 'delete';
  return null;
}
