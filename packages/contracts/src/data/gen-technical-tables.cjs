const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'du_lieu_matching_ky_thuat.json');
const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const lines = [];

lines.push('/**');
lines.push(' * Bảng tra cứu matching Kỹ thuật — đồng bộ từ du_lieu_matching_ky_thuat.json');
lines.push(` * phiên_bản ${d.phien_ban} / ${d.ngay}`);
lines.push(' * Không sửa tay các ma trận; cập nhật JSON rồi chạy gen-technical-tables.cjs.');
lines.push(' */');
lines.push('');
lines.push(
  `export const TECH_MATCH_DATA_VERSION = ${JSON.stringify({ phien_ban: d.phien_ban, ngay: d.ngay, nhanh: d.nhanh })} as const;`,
);
lines.push('');
lines.push('export const TECH_MATCH_CONSTANTS = {');
for (const [k, v] of Object.entries(d.hang_so)) {
  lines.push(`  ${k}: ${JSON.stringify(v)},`);
}
lines.push('} as const;');
lines.push('');

function matrix(name, values) {
  lines.push(`export const ${name}: readonly (readonly number[])[] = [`);
  for (const row of values) {
    lines.push(`  [${row.join(', ')}],`);
  }
  lines.push('];');
  lines.push('');
}

function catalog(prefix, items) {
  lines.push(`export const ${prefix}_CODES = ${JSON.stringify(items.map((i) => i.ma))} as const;`);
  lines.push('');
  lines.push(`export const ${prefix}_NAMES: Record<(typeof ${prefix}_CODES)[number], string> = {`);
  for (const item of items) {
    lines.push(`  ${JSON.stringify(item.ma)}: ${JSON.stringify(item.ten)},`);
  }
  lines.push('};');
  lines.push('');
  if (items.some((i) => i.nhom != null)) {
    lines.push(
      `export const ${prefix}_GROUP: Record<(typeof ${prefix}_CODES)[number], number> = {`,
    );
    for (const item of items) {
      lines.push(`  ${JSON.stringify(item.ma)}: ${JSON.stringify(item.nhom)},`);
    }
    lines.push('};');
    lines.push('');
  }
}

catalog('TECH_EQUIPMENT', d.thiet_bi.danh_muc);
matrix('TECH_EQUIPMENT_SIMILARITY_MATRIX', d.thiet_bi.ma_tran.gia_tri);

catalog('TECH_WORK', d.cong_viec_ky_thuat.danh_muc);
matrix('TECH_WORK_SIMILARITY_MATRIX', d.cong_viec_ky_thuat.ma_tran.gia_tri);

catalog('TECH_ENV', d.moi_truong_lam_viec.danh_muc);
matrix('TECH_ENV_SIMILARITY_MATRIX', d.moi_truong_lam_viec.ma_tran.gia_tri);

catalog('TECH_DOC', d.ban_ve_tai_lieu.danh_muc);
matrix('TECH_DOC_SIMILARITY_MATRIX', d.ban_ve_tai_lieu.ma_tran.gia_tri);

lines.push(`export const TECH_TOOL_CATALOG = ${JSON.stringify(d.cong_cu_phan_mem.danh_muc)} as const;`);
lines.push('');

lines.push('export const TECH_TITLE_RANKS: Record<string, number> = {');
for (const item of d.vi_tri.danh_muc) {
  lines.push(`  ${JSON.stringify(item.ten)}: ${item.cap},`);
}
lines.push('};');
lines.push('');

lines.push(`export const TECH_TITLE_SCORES = ${JSON.stringify(d.vi_tri.thang_diem, null, 2)} as const;`);
lines.push('');

const auto = d.thang_bac_co_thu_tu.muc_do_tu_chu;
lines.push(`export const TECH_AUTONOMY_LABELS = ${JSON.stringify(auto.bac)} as const;`);
lines.push('');
lines.push(`export const TECH_AUTONOMY_SCORES = ${JSON.stringify(auto.diem_theo_khoang_cach)} as const;`);
lines.push('');

const shift = d.thang_bac_co_thu_tu.lam_ngoai_gio;
lines.push(`export const TECH_SHIFT_LABELS = ${JSON.stringify(shift.bac)} as const;`);
lines.push('');
lines.push(`export const TECH_SHIFT_SCORES = ${JSON.stringify(shift.diem_theo_khoang_cach)} as const;`);
lines.push('');

const out = path.join(__dirname, '..', 'technical-matching-tables.ts');
fs.writeFileSync(out, `${lines.join('\n')}\n`, 'utf8');
console.log('wrote', out);
