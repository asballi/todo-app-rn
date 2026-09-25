jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-crypto', () => ({
  getRandomBytes: size => new Uint8Array(require('crypto').randomBytes(size)),
}));
