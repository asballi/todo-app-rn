// SQL testleri: npm run test:db
//
// Geçici bir Postgres kümesi başlatır (initdb, yalnızca Unix soketi), Supabase
// taklidini ve supabase/migrations/ dosyalarını bir şablon veritabanına uygular,
// sonra supabase/tests/*.test.js dosyalarını `node --test` ile çalıştırır. Her
// test dosyası şablondan kendi veritabanını oluşturur (bkz. db.js).
//
// Gereken: Postgres sunucu programları (initdb, pg_ctl, postgres). Bulunamazsa
// PG_BIN ile klasör verilebilir. Var olan bir sunucuyu kullanmak için
// TEST_DATABASE_URL (süper kullanıcı) verilir; o zaman küme başlatılmaz.
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');
const TESTS = __dirname;
const TEMPLATE_DB = 'todo_test_template';

function findPgBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  try {
    return execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim();
  } catch {}
  const debianRoot = '/usr/lib/postgresql';
  if (fs.existsSync(debianRoot)) {
    const versions = fs.readdirSync(debianRoot).sort((a, b) => Number(b) - Number(a));
    for (const v of versions) {
      const bin = path.join(debianRoot, v, 'bin');
      if (fs.existsSync(path.join(bin, 'initdb'))) return bin;
    }
  }
  return ''; // PATH'te aranır
}

// Postgres root olarak çalışmaz; root isek programlar postgres kullanıcısıyla çalışır.
const asRoot = process.getuid?.() === 0;

function pg(bin, program, args) {
  const exe = bin ? path.join(bin, program) : program;
  const [cmd, cmdArgs] = asRoot ? ['runuser', ['-u', 'postgres', '--', exe, ...args]] : [exe, args];
  const result = spawnSync(cmd, cmdArgs, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${program} başarısız:\n${result.stderr || result.stdout || result.error}`);
  }
}

async function startCluster() {
  const bin = findPgBin();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-pg-'));
  if (asRoot) execFileSync('chown', ['postgres', dir]);
  const data = path.join(dir, 'data');
  const port = String(55432 + (process.pid % 1000));
  pg(bin, 'initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-locale']);
  pg(bin, 'pg_ctl', [
    '-D', data, '-l', path.join(dir, 'log'), '-w', 'start',
    '-o', `-p ${port} -k ${dir} -c listen_addresses= -c fsync=off`,
  ]);
  return {
    conn: { host: dir, port: Number(port), user: 'postgres' },
    stop() {
      try {
        pg(bin, 'pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

function connFromUrl(url) {
  const u = new URL(url);
  return {
    host: decodeURIComponent(u.hostname),
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password) || undefined,
    database: u.pathname.slice(1) || 'postgres',
  };
}

async function buildTemplate(conn) {
  const admin = new Client({ ...conn, database: conn.database ?? 'postgres' });
  await admin.connect();
  await admin.query(`drop database if exists ${TEMPLATE_DB}`);
  await admin.query(`create database ${TEMPLATE_DB}`);
  await admin.end();

  const db = new Client({ ...conn, database: TEMPLATE_DB });
  await db.connect();
  // Supabase taklidindeki roller küme genelidir; var olan sunucuda zaten olabilir.
  const { rowCount } = await db.query(`select 1 from pg_roles where rolname = 'authenticated'`);
  let mock = fs.readFileSync(path.join(TESTS, 'supabase-mock.sql'), 'utf8');
  if (rowCount) mock = mock.replace(/^create role .*$/gm, '');
  await db.query(mock);
  for (const file of fs.readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    try {
      await db.query(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
    } catch (e) {
      throw new Error(`${file}: ${e.message}`);
    }
  }
  await db.end();
}

async function main() {
  const external = process.env.TEST_DATABASE_URL;
  const cluster = external ? null : await startCluster();
  const conn = external ? connFromUrl(external) : cluster.conn;
  let status = 1;
  try {
    await buildTemplate(conn);
    const files = fs.readdirSync(TESTS).filter(f => f.endsWith('.test.js')).sort()
      .map(f => path.join(TESTS, f));
    const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=spec', ...files], {
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_PG: JSON.stringify(conn),
        TEST_PG_TEMPLATE: TEMPLATE_DB,
      },
    });
    status = result.status ?? 1;
  } finally {
    cluster?.stop();
  }
  process.exit(status);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
