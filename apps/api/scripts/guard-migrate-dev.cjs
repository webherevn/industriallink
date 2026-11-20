/**
 * Chặn `prisma migrate dev` khi trỏ vào DB production.
 *
 * LÝ DO:
 *   `prisma migrate dev` dựng một SHADOW DATABASE rỗng rồi chạy lại TOÀN BỘ
 *   lịch sử migration từ đầu để phát hiện drift. Lịch sử migration của dự án
 *   này được viết theo kiểu "giả định schema đã tồn tại" (đa số object được tạo
 *   bằng `prisma db push` trong quá khứ, không có migration `CREATE SCHEMA` tương ứng).
 *   Vì vậy khi chạy trên shadow DB trống:
 *
 *     Migration `20260724_sales_b2b_profile_matrix` failed to apply cleanly
 *     to the shadow database.
 *     ERROR: schema "candidate" does not exist       -> P3006
 *
 *   `prisma migrate deploy` KHÔNG dùng shadow DB nên không dính lỗi này.
 *
 * CÁCH DÙNG ĐÚNG TRÊN VPS:
 *   pnpm --filter @industriallink/api db:migrate:deploy
 *   (fallback: pnpm --filter @industriallink/api db:push)
 *
 * Chạy: node apps/api/scripts/guard-migrate-dev.cjs
 * Exit 0 = OK (được phép chạy migrate dev), exit 1 = chặn.
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

const url = process.env.DATABASE_URL || '';
if (!url) {
  console.error('GUARD: khong doc duoc DATABASE_URL — cho phep migrate dev.');
  process.exit(0);
}

/**
 * Heuristic: DB production thường nằm ở host không phải localhost.
 * Chỉ chặn khi có dấu hiệu rõ ràng là production:
 *   - host khác localhost / 127.0.0.1
 *   - tên DB chứa "prod"
 * Nếu không chắc → cho phép (để dev vẫn chạy được).
 */
let host = '';
let dbName = '';
try {
  const parsed = new URL(url);
  host = parsed.hostname;
  dbName = parsed.pathname.replace(/^\//, '');
} catch {
  console.error('GUARD: DATABASE_URL khong phai URL hop le — cho phep migrate dev.');
  process.exit(0);
}

const isLocal =
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host === '::1' ||
  host === '0.0.0.0' ||
  host.startsWith('127.') ||
  host.endsWith('.local');

const looksProduction = !isLocal || /prod/i.test(dbName);

if (!looksProduction) {
  console.log(`GUARD: OK — ${host}/${dbName} la DB local, migrate dev duoc phep.`);
  process.exit(0);
}

console.error('');
console.error('================================================================');
console.error('  GUARD: CHAN `prisma migrate dev` tren DB PRODUCTION');
console.error('================================================================');
console.error(`  DATABASE_URL tro toi: ${host}/${dbName}`);
console.error('');
console.error('  `migrate dev` dung SHADOW DATABASE roi chay lai TOAN BO lich su');
console.error('  migration tu dau. Lich su migration cua du an khong co');
console.error('  `CREATE SCHEMA candidate` (schema duoc tao bang `db push`), nen shadow');
console.error('  DB trong se fail:');
console.error('');
console.error('    ERROR: schema "candidate" does not exist   -> P3006');
console.error('');
console.error('  DUNG LENH NAY TREN VPS:');
console.error('    pnpm --filter @industriallink/api db:migrate:deploy');
console.error('');
console.error('  Neu production DB chua tung chay migrate (drift), fallback:');
console.error('    pnpm --filter @industriallink/api db:push');
console.error('================================================================');
console.error('');
process.exit(1);
