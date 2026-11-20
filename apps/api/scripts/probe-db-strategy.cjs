/**
 * Trả lời 1 câu: production DB nên dùng `migrate deploy` hay `db push`?
 *
 * Chạy: node apps/api/scripts/probe-db-strategy.cjs
 * Exit 0 = OK (thông tin), luôn exit 0 — chỉ để in ra thông tin.
 */
const fs = require('node:fs');
const path = require('node:path');

function loadEnv() {
  const candidates = [
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../.env'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] !== undefined) continue;
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadEnv();

const { PrismaClient } = require('@prisma/client');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'prisma', 'migrations');

function localMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const found = await prisma.$queryRawUnsafe(`
      SELECT n.nspname AS schema, c.relname AS table
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = '_prisma_migrations' AND c.relkind = 'r' LIMIT 1
    `);

    const all = localMigrations();

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  PROBE DB PRODUCTION — chọn chiến lược đồng bộ schema          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`  migration tren disk: ${all.length}`);

    if (!found.length) {
      console.log('');
      console.log('  ► KHÔNG có bảng _prisma_migrations.');
      console.log('    → DB production được tạo bằng `db push`, chưa từng chạy migrate.');
      console.log('');
      console.log('  ► DÙNG:  pnpm --filter @industriallink/api db:push');
      console.log('    (KHÔNG dùng migrate deploy: sẽ cố apply lại 70+ migration cũ');
      console.log('     từ đầu, migration cũ giả định schema đã có → hỏng.)');
      console.log('');
      console.log('  ► Migration KYC chỉ ADD enum/bảng/cột → db push an toàn, không mất dữ liệu.');
      await prisma.$disconnect();
      process.exit(0);
    }

    const table = `"${found[0].schema}"."${found[0].table}"`;
    const rows = await prisma.$queryRawUnsafe(
      `SELECT migration_name, finished_at IS NOT NULL AS ok, rolled_back_at IS NOT NULL AS rb
       FROM ${table} ORDER BY started_at`,
    );
    const applied = rows.filter((r) => r.ok).map((r) => r.migration_name);
    const failed = rows.filter((r) => !r.ok && !r.rb);
    const pending = all.filter((n) => !applied.includes(n));

    console.log(`  da apply xong: ${applied.length}`);
    console.log(`  dang fail:     ${failed.length}`);
    console.log(`  chua apply:    ${pending.length}`);

    if (failed.length) {
      console.log('');
      console.log('  ► CÓ migration đang FAIL → phải mở khóa trước:');
      console.log('    (cd apps/api && node scripts/resolve-failed-migrations.cjs)');
      failed.forEach((r) => console.log(`      - ${r.migration_name}`));
    }

    if (pending.length) {
      console.log('');
      console.log('  ► Migration chưa apply (sẽ chạy ở lần deploy kế tiếp):');
      pending.slice(-10).forEach((n) => console.log(`      - ${n}`));
      if (pending.length > 10) console.log(`      ... va ${pending.length - 10} migration nua`);
    }

    // Kiểm tra riêng: có migration nào trong "pending" giả định schema có sẵn không?
    // (20260724 dùng candidate.* mà không có CREATE SCHEMA candidate)
    const risky = pending.filter((n) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, n, 'migration.sql'), 'utf8');
      return /ALTER\s+TABLE\s+"?candidate\.?/i.test(sql) || /REFERENCES\s+"?candidate\.?/i.test(sql);
    });
    if (risky.length) {
      console.log('');
      console.log('  ⚠ Migration pending giả định schema "candidate" đã tồn tại:');
      risky.forEach((n) => console.log(`      - ${n}`));
      console.log('    Nếu lịch sử migrate trong DB bị thiếu các migration đầu,');
      console.log('    `migrate deploy` sẽ fail. Khi đó dùng `db:push`.');
    }

    console.log('');
    console.log('  ► DÙNG:  pnpm --filter @industriallink/api db:migrate:deploy');
    console.log('    fallback: pnpm --filter @industriallink/api db:push');
  } catch (err) {
    console.error('FAIL:', err && err.message ? err.message.split('\n')[0] : String(err));
  } finally {
    await prisma.$disconnect();
  }
  process.exit(0);
})();
