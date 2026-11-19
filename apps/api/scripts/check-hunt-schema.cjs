/**
 * Kiểm tra schema DB production sau khi deploy (refactor Săn nhân sự 1-1).
 * Chạy: node apps/api/scripts/check-hunt-schema.cjs
 * Exit 0 = OK, exit 1 = thiếu bảng/cột.
 *
 * Lưu ý: Prisma Client tự đọc `.env` từ thư mục `prisma/`. Trên VPS, `.env` chỉ nằm ở gốc
 * monorepo (`/www/wwwroot/inlink/.env`) nên ta nạp thủ công. Script nằm ở `apps/api/scripts`
 * → gốc monorepo là `../../../.env` (KHÔNG phải `../../.env` — cái đó trỏ tới `apps/.env`).
 */
const fs = require('node:fs');
const path = require('node:path');

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

const TABLES = [
  'billing_hunt_package',
  'hunt_campaign',
  'hunt_campaign_activity',
];

(async () => {
  const p = new PrismaClient();
  let bad = 0;
  try {
    const r = await p.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'billing' AND table_name IN ('${TABLES.join("','")}')`,
    );
    const have = r.map((x) => x.table_name);
    for (const t of TABLES) {
      if (have.includes(t)) console.log(`OK: billing.${t}`);
      else {
        console.log(`FAIL: thieu bang billing.${t}`);
        bad++;
      }
    }

    const c = await p.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'billing' AND table_name = 'billing_credit_transaction'
         AND column_name = 'campaign_id'`,
    );
    if (c.length) console.log('OK: billing_credit_transaction.campaign_id');
    else {
      console.log('FAIL: thieu cot billing_credit_transaction.campaign_id');
      bad++;
    }

    // Bang cu da duoc drop sau refactor — chi bao loi neu con ton tai.
    const old = await p.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'billing' AND table_name IN (
         'billing_sourcing_usage','billing_sourcing_engagement','billing_sourcing_package'
       )`,
    );
    if (old.length) {
      console.log(`WARN: bang cu van con: ${old.map((x) => x.table_name).join(', ')}`);
    } else {
      console.log('OK: da drop cac bang cu (billing_sourcing_usage/_engagement/_package)');
    }
  } catch (e) {
    console.log('FAIL: khong ket noi duoc DB —', e.message.split('\n')[0]);
    bad++;
  } finally {
    await p.$disconnect();
  }
  process.exit(bad ? 1 : 0);
})();
