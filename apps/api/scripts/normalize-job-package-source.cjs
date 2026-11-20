/**
 * Chuẩn hoá dữ liệu tin tuyển dụng theo bất biến "1 nguồn gói trả phí / 1 tin".
 *
 * Bối cảnh: trước đây `sourcing.service.ts` cộng dồn hạn (`baseDate = deadline hiện tại`)
 * nên khi mở gói Săn cho 1 tin đang chạy gói Tin đăng 30 ngày, hạn tin bị đẩy lên 60 ngày
 * → hiển thị sai "còn 60 ngày".
 *
 * Script này (idempotent, chạy được nhiều lần):
 *   1. Tìm các tin đang bị "chồng 2 nguồn gói": vừa có `job_package_id` (gói Tin đăng
 *      trả phí) vừa thuộc 1 chiến dịch Săn còn hiệu lực.
 *      → NGẮT liên kết gói Tin đăng (`job_package_id = NULL`), giữ nguồn gói Săn.
 *   2. Tìm các tin thuộc chiến dịch Săn nhưng hạn hiển thị > 30 ngày (dấu vết của
 *      lỗi cộng dồn) → đặt lại hạn = ngày hiện tại + 30 ngày.
 *
 * Không in DATABASE_URL ra ngoài.
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const envPath = path.resolve(__dirname, '../../../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbLine = envContent.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
if (!dbLine) {
  console.error('DATABASE_URL not found in root .env');
  process.exit(1);
}
process.env.DATABASE_URL = dbLine.slice('DATABASE_URL='.length).trim();

const prisma = new PrismaClient();

/** Ngày dương lịch VN (múi giờ Asia/Ho_Chi_Minh) → Date tại 00:00:00.000Z. */
function vnDateString(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
}

function addVnCalendarDays(from, days) {
  const base = new Date(`${vnDateString(from)}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base;
}

(async () => {
  // ---- 1. Tin bị chồng 2 nguồn gói (gói Tin đăng trả phí + chiến dịch Săn) ----
  const duplicated = await prisma.$queryRaw`
    SELECT j.id::text AS id,
           j.code,
           j.deadline,
           p.code AS job_package_code,
           p.package_type,
           (SELECT hc.code
              FROM billing.hunt_campaign hc
             WHERE hc.job_id = j.id
               AND hc.status <> 'closed'
             LIMIT 1) AS hunt_campaign_code
      FROM recruitment.job j
      LEFT JOIN billing.billing_job_package p ON p.id = j.job_package_id
     WHERE j.is_deleted = false
       AND j.job_package_id IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM billing.hunt_campaign hc
          WHERE hc.job_id = j.id
            AND hc.status <> 'closed'
       )
  `;

  if (duplicated.length === 0) {
    console.log('[1] Không có tin nào bị chồng 2 nguồn gói → không cần sửa.');
  } else {
    console.log(`[1] Tìm thấy ${duplicated.length} tin bị chồng 2 nguồn gói:`);
    for (const row of duplicated) {
      console.log(
        `  ${row.code} | gói tin đăng=${row.job_package_code} (${row.package_type}) | ` +
          `chiến dịch săn=${row.hunt_campaign_code ?? '-'}`,
      );
      await prisma.job.update({
        where: { id: row.id },
        data: { jobPackageId: null },
      });
      console.log(`    ✔ đã ngắt gói tin đăng, giữ nguồn gói Săn (${row.code})`);
    }
  }

  // ---- 2. Tin thuộc chiến dịch Săn nhưng hạn > 30 ngày (dấu vết lỗi cộng dồn) ----
  const newDeadline = addVnCalendarDays(new Date(), 30);
  const overlong = await prisma.$queryRaw`
    SELECT j.id::text AS id,
           j.code,
           j.deadline
      FROM recruitment.job j
     WHERE j.is_deleted = false
       AND j.deadline IS NOT NULL
       AND j.deadline > ${newDeadline}
       AND EXISTS (
         SELECT 1
           FROM billing.hunt_campaign hc
          WHERE hc.job_id = j.id
            AND hc.status <> 'closed'
       )
  `;

  if (overlong.length === 0) {
    console.log('[2] Không có tin Săn nào bị cộng dồn hạn > 30 ngày → không cần sửa.');
  } else {
    console.log(`[2] Tìm thấy ${overlong.length} tin Săn bị cộng dồn hạn > 30 ngày:`);
    for (const row of overlong) {
      console.log(
        `  ${row.code} | deadline ${vnDateString(row.deadline)} → ${vnDateString(newDeadline)}`,
      );
      await prisma.job.update({
        where: { id: row.id },
        data: { deadline: newDeadline },
      });
      console.log(`    ✔ đã đặt lại hạn 30 ngày (${row.code})`);
    }
  }

  console.log('Hoàn tất.');
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
