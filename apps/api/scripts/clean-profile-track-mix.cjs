/**
 * Dọn dữ liệu hồ sơ bị LAI TẠP giữa 2 nhánh lĩnh vực (Kinh doanh <-> Kỹ thuật).
 *
 * Vấn đề: hồ sơ ứng viên có thể lưu đồng thời dữ liệu mục 13+ của CẢ 2 nhánh
 * (do đổi lĩnh vực trước đây không xóa field của nhánh cũ). Điều này làm AI
 * Matching chấm sai vì dữ liệu của nhánh không active "lọt" vào bảng trọng số.
 *
 * Ranh giới (xem packages/contracts/src/profile-track-boundary.ts):
 * - job_track = 'technical' -> xóa sạch field đặc thù KINH DOANH.
 * - job_track = 'sales'     -> xóa sạch field đặc thù KỸ THUẬT.
 * - desiredPositions (mục 13) -> lọc về đúng danh mục của nhánh, tối đa 3.
 * - currentPosition -> theo vị trí đầu tiên của nhánh đang active.
 *
 * Chạy:  node apps/api/scripts/clean-profile-track-mix.cjs [--dry-run] [--all]
 *   --dry-run  chỉ báo cáo, không ghi DB (mặc định)
 *   --all      dọn TẤT CẢ ứng viên (bỏ qua tài khoản test)
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

/** Danh mục vị trí ứng tuyển chuẩn — phải khớp contracts. */
const SALES_POSITIONS = [
  'Thực tập sinh kinh doanh',
  'Chăm sóc khách hàng',
  'Nhân viên kinh doanh',
  'Trưởng nhóm kinh doanh',
  'Trưởng phòng kinh doanh',
  'Giám đốc kinh doanh',
];
const TECHNICAL_POSITIONS = [
  'Thực tập sinh kỹ thuật',
  'Kỹ thuật viên',
  'Kỹ sư dịch vụ / Bảo trì – sửa chữa',
  'Kỹ sư cơ khí',
  'Kỹ sư điện / Điện công nghiệp',
  'Kỹ sư tự động hóa / Điều khiển',
  'Kỹ sư thiết kế',
  'Kỹ sư dự án',
  'Kỹ sư sản xuất / Quy trình',
  'Kỹ sư chất lượng QA/QC',
  'Kỹ sư R&D',
  'Quản lý kỹ thuật',
  'Quản lý dự án',
  'Quản lý / vận hành nhà máy',
];

const MAX_POSITIONS = 3;

/** Field đặc thù nhánh Kinh doanh — xóa khi job_track = technical. */
const SALES_ONLY_FIELDS = [
  'b2bExperienceBand',
  'marketsCovered',
  'customerDevStyle',
  'dealType',
  'typicalDealValue',
  'maxDealValue',
  'sellingStages',
  'latestRevenue',
  'kpiAchievementPct',
  'newCustomerRatioPct',
  'expectedOte',
  'hasB2License',
  'driverLicenseType',
];

/** Field đặc thù nhánh Kỹ thuật — xóa khi job_track = sales. */
const TECHNICAL_ONLY_FIELDS = [
  'brandsTechnologies',
  'technicalWorkTypes',
  'technicalAutonomyLevel',
  'troubleshootingLevel',
  'technicalTools',
  'documentLiteracy',
  'systemScaleNote',
  'shiftFlexibility',
  'desiredWorkEnvironments',
];

const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--all');

function sanitizePositions(values, track) {
  const allowed = allowedPositionsFor(track);
  const out = [];
  for (const raw of values || []) {
    const v = String(raw || '').trim();
    if (!v || !allowed.has(v) || out.includes(v)) continue;
    out.push(v);
    if (out.length >= MAX_POSITIONS) break;
  }
  return out;
}

/** Danh mục vị trí ứng tuyển chuẩn của 1 nhánh. */
function allowedPositionsFor(track) {
  return new Set(track === 'technical' ? TECHNICAL_POSITIONS : SALES_POSITIONS);
}

function buildUpdates(profile) {
  const track = (profile.job_track || 'sales').toString().toLowerCase();
  const isTech = track === 'technical';
  const updates = {};

  const clearFields = isTech ? SALES_ONLY_FIELDS : TECHNICAL_ONLY_FIELDS;
  for (const field of clearFields) {
    const current = profile[field];
    const isArray = Array.isArray(current);
    const dirty = isArray ? current.length > 0 : current != null;
    if (!dirty) continue;
    updates[field] = isArray ? [] : null;
  }

  const positions = sanitizePositions(profile.desired_positions, track);
  const currentPositions = profile.desired_positions || [];
  const positionsChanged =
    positions.length !== currentPositions.length ||
    positions.some((p, i) => p !== currentPositions[i]);
  if (positionsChanged) updates.desired_positions = positions;

  if (positions.length > 0 && profile.current_position !== positions[0]) {
    updates.current_position = positions[0];
  } else if (positions.length === 0) {
    // ⭐ Chức danh hiện tại KHÔNG thuộc danh mục vị trí của nhánh đang active
    // → đây là dữ liệu lẫn tạp của nhánh cũ (VD: đã đổi sang Kỹ thuật nhưng
    // vẫn còn "Thực tập sinh kinh doanh") → xoá đi.
    const current = String(profile.current_position || '').trim();
    if (current && !allowedPositionsFor(track).has(current)) {
      updates.current_position = null;
    }
  }

  return { track, updates };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const profiles = await prisma.$queryRaw`
      SELECT cp.id, cp.candidate_id, cp.job_track, cp.desired_positions,
             cp.current_position, cp.b2b_experience_band, cp.markets_covered,
             cp.customer_dev_style, cp.deal_type, cp.typical_deal_value,
             cp.max_deal_value, cp.selling_stages, cp.latest_revenue,
             cp.kpi_achievement_pct, cp.new_customer_ratio_pct, cp.expected_ote,
             cp.has_b2_license, cp.driver_license_type, cp.brands_technologies,
             cp.technical_work_types, cp.technical_autonomy_level,
             cp.troubleshooting_level, cp.technical_tools, cp.document_literacy,
             cp.system_scale_note, cp.shift_flexibility, cp.desired_work_environments
      FROM candidate.candidate_profile cp
      WHERE cp.job_track IS NOT NULL
    `;

    let dirty = 0;
    for (const row of profiles) {
      const { track, updates } = buildUpdates(row);
      const keys = Object.keys(updates);
      if (keys.length === 0) continue;
      dirty += 1;
      console.log(
        `[${track}] ${row.candidate_id} — cần sạch: ${keys.join(', ')}`,
      );
      if (!dryRun) {
        const sets = keys.map((k) => `"${k}" = $${k}`).join(', ');
        await prisma.$executeRawUnsafe(
          `UPDATE candidate.candidate_profile SET ${sets} WHERE id = $id`,
          { ...updates, id: row.id },
        );
      }
    }

    console.log(
      `\nTổng: ${profiles.length} hồ sơ — ${dirty} cần làm sạch. ` +
        (dryRun ? 'DRY-RUN (chưa ghi DB). Thêm --all để ghi.' : 'ĐÃ ghi DB.'),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
