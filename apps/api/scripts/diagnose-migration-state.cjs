/**
 * Chẩn đoán trạng thái migration trên DB (dùng khi `prisma migrate dev` báo P3006
 * hoặc cần biết migration nào đã apply / đang fail).
 *
 * Bối cảnh:
 *   `prisma migrate dev` dựng SHADOW DATABASE rỗng rồi chạy lại toàn bộ lịch sử
 *   migration từ đầu để dò drift. Lịch sử migration của dự án giả định schema
 *   đã tồn tại (đa số object tạo bằng `prisma db push`, không có migration
 *   `CREATE SCHEMA candidate`), nên shadow DB trống sẽ fail:
 *
 *     ERROR: schema "candidate" does not exist        → P3006
 *
 *   → Trên VPS phải dùng `db:migrate:deploy` (không dùng shadow DB) hoặc `db:push`.
 *
 * Chạy: node apps/api/scripts/diagnose-migration-state.cjs
 * Exit 0 = OK, exit 1 = có vấn đề cần xử lý.
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

/** Schema Prisma khai báo trong datasource. */
const EXPECTED_SCHEMAS = [
  'identity',
  'candidate',
  'knowledge',
  'shared',
  'company',
  'recruitment',
  'cms',
  'billing',
  'crm',
];

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'prisma', 'migrations');

/** Danh sách migration trên disk (tên thư mục). */
function localMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

(async () => {
  const prisma = new PrismaClient();
  let hasProblem = false;
  try {
    // ── 1) Schema trong DB ────────────────────────────────────────────────
    console.log('=== 1) SCHEMA TRONG DB ===');
    const schemas = await prisma.$queryRawUnsafe(
      `SELECT nspname FROM pg_namespace ORDER BY nspname`,
    );
    const present = new Set(schemas.map((row) => row.nspname));
    for (const name of EXPECTED_SCHEMAS) {
      const ok = present.has(name);
      if (!ok) hasProblem = true;
      console.log(`  ${ok ? 'OK  ' : 'THIEU'} ${name}`);
    }

    // ── 2) Lịch sử migration ─────────────────────────────────────────────
    console.log('');
    console.log('=== 2) LICH SU MIGRATION ===');
    const found = await prisma.$queryRawUnsafe(`
      SELECT n.nspname AS schema, c.relname AS table
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = '_prisma_migrations' AND c.relkind = 'r'
      LIMIT 1
    `);
    if (!found.length) {
      console.log('  KHONG CO bang _prisma_migrations.');
      console.log('  → DB chua tung chay migrate (duoc tao bang `db push`).');
      console.log('  → dung `db:push` de dong bo schema.');
      hasProblem = true;
    } else {
      const table = `"${found[0].schema}"."${found[0].table}"`;
      const rows = await prisma.$queryRawUnsafe(
        `SELECT migration_name,
                finished_at IS NOT NULL AS ok,
                rolled_back_at IS NOT NULL AS rolled_back
         FROM ${table}
         ORDER BY started_at`,
      );
      const applied = rows.filter((r) => r.ok).map((r) => r.migration_name);
      const failed = rows.filter((r) => !r.ok && !r.rolled_back);
      const rolledBack = rows.filter((r) => !r.ok && r.rolled_back);

      console.log(`  da apply xong: ${applied.length}`);
      console.log(`  dang fail:     ${failed.length}`);
      console.log(`  da rollback:   ${rolledBack.length}`);

      if (failed.length) {
        console.log('');
        console.log('  MIGRATION DANG FAIL (phai `prisma migrate resolve`):');
        failed.forEach((row) => console.log(`    - ${row.migration_name}`));
        hasProblem = true;
      }
      if (rolledBack.length) {
        console.log('');
        console.log('  MIGRATION DA ROLLBACK (se chay lai lan deploy toi):');
        rolledBack.forEach((row) => console.log(`    - ${row.migration_name}`));
      }

      // Migration trên disk chưa từng apply → sẽ chạy ở lần deploy kế tiếp.
      const pending = localMigrations().filter((name) => !applied.includes(name));
      if (pending.length) {
        console.log('');
        console.log(`  MIGRATION CHUA APPLY (${pending.length}):`);
        pending.forEach((name) => console.log(`    - ${name}`));
      } else {
        console.log('');
        console.log('  tat ca migration tren disk deu da apply.');
      }
    }

    // ── 3) Object KYC ─────────────────────────────────────────────────────
    console.log('');
    console.log('=== 3) OBJECT KYC ===');
    const kycTable = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS c FROM information_schema.tables
      WHERE table_schema = 'crm' AND table_name = 'crm_partner_kyc'
    `);
    const kycEnum = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS c FROM pg_type WHERE typname = 'CrmKycStatus'
    `);
    const kycCols = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS c FROM information_schema.columns
      WHERE table_schema = 'crm' AND table_name = 'crm_commission_period'
        AND column_name IN ('gross_amount_vnd','pit_tax_amount_vnd','net_paid_amount_vnd','transfer_ref')
    `);
    const claimCols = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS c FROM information_schema.columns
      WHERE table_schema = 'crm' AND table_name = 'crm_partner_claim'
        AND column_name IN ('status','expires_at')
    `);
    console.log(`  bang crm.crm_partner_kyc:        ${kycTable[0].c > 0 ? 'OK' : 'THIEU'}`);
    console.log(`  enum CrmKycStatus:               ${kycEnum[0].c > 0 ? 'OK' : 'THIEU'}`);
    console.log(`  4 cot ke toan (gross/pit/net/unc): ${kycCols[0].c === 4 ? 'OK' : `THIEU (${kycCols[0].c}/4)`}`);
    console.log(`  2 cot khoa MST (status/expires): ${claimCols[0].c === 2 ? 'OK' : `THIEU (${claimCols[0].c}/2)`}`);
    if (
      kycTable[0].c === 0 ||
      kycEnum[0].c === 0 ||
      kycCols[0].c !== 4 ||
      claimCols[0].c !== 2
    ) {
      hasProblem = true;
    }

    // ── 4) Trạng thái KYC của CTV ─────────────────────────────────────────
    console.log('');
    console.log('=== 4) TRANG THAI KYC CUA CTV ===');
    const byStatus = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(k.status::text, 'UNVERIFIED') AS status, count(*)::int AS c
      FROM crm.crm_partner pt
      LEFT JOIN crm.crm_partner_kyc k ON k.partner_id = pt.id
      GROUP BY 1 ORDER BY 1
    `);
    byStatus.forEach((row) => console.log(`  ${row.status}: ${row.c}`));
    const payable = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS c FROM crm.crm_commission_period WHERE status = 'payable'
    `);
    console.log(`  ky choi da duyet chi (status=payable): ${payable[0].c}`);
    console.log('  → moi ky co status VERIFIED moi chi duoc (Payout Gate).');
  } catch (err) {
    console.error('FAIL:', err && err.message ? err.message.split('\n')[0] : String(err));
    hasProblem = true;
  } finally {
    await prisma.$disconnect();
  }

  console.log('');
  if (hasProblem) {
    console.log('=== KET LUAN: co van de xu ly ===');
    console.log('  - Neu DB chua tung chay migrate: dung `pnpm --filter @industriallink/api db:push`');
    console.log('  - Neu co migration fail: chay `node apps/api/scripts/resolve-failed-migrations.cjs`');
    console.log('  - KHONG dung `prisma migrate dev` tren VPS (shadow DB → P3006).');
    process.exit(1);
  }
  console.log('=== KET LUAN: OK ===');
  process.exit(0);
})();
