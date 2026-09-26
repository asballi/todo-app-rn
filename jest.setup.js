jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-crypto', () => ({
  getRandomBytes: size => new Uint8Array(require('crypto').randomBytes(size)),
}));

// Kaydırma hareketleri (SwipeableRow): yerel modüller yerine test sürümleri.
require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
