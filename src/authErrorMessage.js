const MESSAGES = {
  'auth/invalid-credential': 'E-posta veya şifre hatalı.',
  'auth/wrong-password': 'E-posta veya şifre hatalı.',
  'auth/user-not-found': 'E-posta veya şifre hatalı.',
  'auth/email-already-in-use': 'Bu e-posta ile zaten bir hesap var.',
  'auth/invalid-email': 'Geçerli bir e-posta adresi girin.',
  'auth/missing-password': 'Şifre girin.',
  'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
  'auth/too-many-requests': 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.',
  'auth/network-request-failed': 'İnternet bağlantısı yok. Bağlantınızı kontrol edin.',
};

// Turns a Firebase Auth error into a message to show the user.
export function authErrorMessage(error) {
  return MESSAGES[error.code] || 'Bir şeyler ters gitti. Lütfen tekrar deneyin.';
}
