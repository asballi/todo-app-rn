import { authErrorMessage } from '../authErrorMessage';

test.each(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'])(
  '%s için "e-posta veya şifre hatalı" denir',
  code => {
    expect(authErrorMessage({ code })).toBe('E-posta veya şifre hatalı.');
  }
);

test.each([
  ['auth/email-already-in-use', 'Bu e-posta ile zaten bir hesap var.'],
  ['auth/invalid-email', 'Geçerli bir e-posta adresi girin.'],
  ['auth/missing-password', 'Şifre girin.'],
  ['auth/weak-password', 'Şifre en az 6 karakter olmalı.'],
  ['auth/too-many-requests', 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.'],
  ['auth/network-request-failed', 'İnternet bağlantısı yok. Bağlantınızı kontrol edin.'],
])('%s için doğru mesaj gösterilir', (code, message) => {
  expect(authErrorMessage({ code })).toBe(message);
});

test('bilinmeyen bir hata için genel bir mesaj gösterilir', () => {
  expect(authErrorMessage({ code: 'auth/something-new' })).toBe(
    'Bir şeyler ters gitti. Lütfen tekrar deneyin.'
  );
  expect(authErrorMessage(new Error('beklenmedik'))).toBe(
    'Bir şeyler ters gitti. Lütfen tekrar deneyin.'
  );
});
