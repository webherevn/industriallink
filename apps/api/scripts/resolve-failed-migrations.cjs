/**
 * Tự phục hồi khi `prisma migrate deploy` bị kẹt vì một migration đã fail trong DB production.
 *
 * Bối cảnh: khi migration fail giữa chừng, Prisma ghi 1 dòng `failed` trong bảng
 * `_prisma_migrations` và TỪ CHỐI chạy tiếp ("New migrations cannot be applied before the
 * error is recovered from"). Cần `prisma migrate resolve --rolled-back` để mở khoá.
 *
 * Cơ chế:
 *  1. Đọc các migration đang fail trong `_prisma_migrations`.
 *  2. Với mỗi migration có trong danh sách biết:
 *     - Kiểm tra các object mà migration đó tạo đã có trong DB chưa (để log).
 *     - Đánh dấu `--rolled-back` → migration sẽ được chạy lại ở lần deploy kế tiếp.
 *       An toàn vì 2 migration này viết theo kiểu idempotent
 *       (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / ON CONFLICT DO NOTHING),
 *       nên chạy lại không làm hỏng dữ liệu và giúp hoàn tất phần backfill còn dang dở.
 *  3. Migration không nằm trong danh sách biết → SKIP (không tự quyết, cần xem tay).
 *
 * Chạy: node apps/api/scripts/resolve-failed-migrations.cjs
 * Exit 0 = OK (đã phục hồi hoặc không có gì cần phục hồi), exit 1 = lỗi.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function loadEnv() {
  // Thứ tự: gần → xa. `process.env` đã có thì không ghi đè.
  const candidates = [
    path.resolve(__dirname, '../../../.env'), // gốc monorepo (VPS)
    path.resolve(__dirname, '../../.env'), // apps/.env
    path.resolve(__dirname, '../.env'), // apps/api/.env
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

/**
 * Migration biết trước + các object nó tạo (chỉ để log/trạng thái).
 * Cả hai đều idempotent nên luôn `--rolled-back` để chạy lại hoàn tất backfill.
 */
const KNOWN = {
  '20261119_billing_job_package': {
    tables: [
      { schema: 'billing', table: 'billing_job_package' },
      { schema: 'billing', table: 'billing_credit_lot' },
    ],
    columns: [{ schema: 'recruitment', table: 'job', column: 'job_package_id' }],
  },
  '20261120_hunt_package_campaign': {
    tables: [
      { schema: 'billing', table: 'billing_hunt_package' },
      { schema: 'billing', table: 'hunt_campaign' },
      { schema: 'billing', table: 'hunt_campaign_activity' },
    ],
    columns: [{ schema: 'billing', table: 'billing_credit_transaction', column: 'campaign_id' }],
  },
  '20261122_crm_partner_kyc': {
    tables: [{ schema: 'crm', table: 'crm_partner_kyc' }],
    columns: [
      { schema: 'crm', table: 'crm_partner_claim', column: 'status' },
      { schema: 'crm', table: 'crm_partner_claim', column: 'expires_at' },
      { schema: 'crm', table: 'crm_commission_period', column: 'gross_amount_vnd' },
      { schema: 'crm', table: 'crm_commission_period', column: 'pit_tax_amount_vnd' },
      { schema: 'crm', table: 'crm_commission_period', column: 'net_paid_amount_vnd' },
      { schema: 'crm', table: 'crm_commission_period', column: 'transfer_ref' },
    ],
  },
};

function prismaResolve(migrationName, mode) {
  // Dùng binary Prisma đã cài sẵn (pnpm tạo symlink trong apps/api/node_modules/.bin).
  // Không phụ thuộc `npx` — VPS có thể không có global npx.
  const apiDir = path.resolve(__dirname, '..');
  const isWin = process.platform === 'win32';
  const bin = path.join(apiDir, 'node_modules', '.bin', isWin ? 'prisma.cmd' : 'prisma');
  const useLocal = fs.existsSync(bin);
  const cmd = useLocal ? bin : 'npx';
  const args = useLocal
    ? ['migrate', 'resolve', mode, migrationName]
    : ['prisma', 'migrate', 'resolve', mode, migrationName];
  execFileSync(cmd, args, { cwd: apiDir, stdio: 'inherit', shell: isWin });
}

(async () => {
  const prisma = new PrismaClient();
  try {
    // `_prisma_migrations` nằm ở schema theo tham số `?schema=` của DATABASE_URL
    // (thường là `public`) — dùng to_regclass để không phụ thuộc search_path.
    const found = await prisma.$queryRawUnsafe(
      `SELECT n.nspname AS schema, c.relname AS table
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relname = '_prisma_migrations' AND c.relkind = 'r'
       LIMIT 1`,
    );
    if (!found.length) {
      console.log('OK: khong co bang _prisma_migrations — can lam gi');
      process.exit(0);
    }
    const migrationsTable = `"${found[0].schema}"."${found[0].table}"`;

    const failed = await prisma.$queryRawUnsafe(
      `SELECT migration_name, started_at
       FROM ${migrationsTable}
       WHERE finished_at IS NULL AND rolled_back_at IS NULL
       ORDER BY started_at DESC`,
    );

    if (!failed.length) {
      console.log('OK: khong co migration nao bi fail — can lam gi');
      process.exit(0);
    }

    for (const row of failed) {
      const name = row.migration_name;
      const spec = KNOWN[name];

      // Migration không nằm trong danh sách biết → KHÔNG tự quyết (an toàn).
      if (!spec) {
        console.log(`SKIP: migration ${name} khong nam trong danh sach kiem tra — can xem tay`);
        continue;
      }

      for (const t of spec.tables) {
        const r = await prisma.$queryRawUnsafe(
          `SELECT 1 FROM information_schema.tables
           WHERE table_schema = $1 AND table_name = $2`,
          t.schema,
          t.table,
        );
        console.log(
          r.length
            ? `  OK: bang ${t.schema}.${t.table} da ton tai`
            : `  MISSING: bang ${t.schema}.${t.table}`,
        );
      }
      for (const c of spec.columns) {
        const r = await prisma.$queryRawUnsafe(
          `SELECT 1 FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
          c.schema,
          c.table,
          c.column,
        );
        console.log(
          r.length
            ? `  OK: cot ${c.schema}.${c.table}.${c.column} da ton tai`
            : `  MISSING: cot ${c.schema}.${c.table}.${c.column}`,
        );
      }

      // Đánh dấu rolled-back → migration được chạy lại (idempotent) ở lần deploy kế tiếp.
      console.log(`RESOLVE ROLLED-BACK: ${name} — se chay lai migration`);
      prismaResolve(name, '--rolled-back');
    }
  } catch (e) {
    console.error('FAIL: khong phuc hoi duoc migration —', e.message.split('\n')[0]);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
  process.exit(0);
})();
