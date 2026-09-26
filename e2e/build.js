// e2e için web derlemesi: senkron, sahte Supabase sunucusuna (e2e/fakeSupabase.mjs)
// bağlanacak şekilde yapılandırılır. --clear: EXPO_PUBLIC_ değişkenleri Metro
// önbelleğinde kalmasın.
const { spawnSync } = require('child_process');

const port = process.env.E2E_SUPABASE_PORT ?? 8124;
const result = spawnSync('npx', ['expo', 'export', '--clear', '--platform', 'web', '--output-dir', 'dist'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    EXPO_PUBLIC_SUPABASE_URL: `http://localhost:${port}`,
    EXPO_PUBLIC_SUPABASE_KEY: 'e2e-publishable-key',
  },
});
process.exit(result.status ?? 1);
