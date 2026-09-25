// Uçtan uca (e2e) tarayıcı testleri. Çalıştırma: npm run e2e
// (önce web derlemesi dist/ klasörüne alınır, sonra testler koşar).
const { defineConfig } = require('@playwright/test');

const port = Number(process.env.E2E_PORT ?? 8123);

module.exports = defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 400, height: 1000 },
    timezoneId: 'Europe/Istanbul',
    locale: 'tr-TR',
    browserName: 'chromium',
  },
  webServer: {
    command: 'node e2e/serve.js',
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
