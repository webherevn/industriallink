const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'du_lieu_matching_sales.json');
const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const lines = [];

lines.push('/**');
lines.push(' * Bảng tra cứu matching Sales — đồng bộ từ du_lieu_matching_sales.json');
lines.push(` * phiên_bản ${d.phien_ban} / ${d.ngay}`);
lines.push(' * Không sửa tay các ma trận; cập nhật JSON rồi chạy gen-tables.cjs.');
lines.push(' */');
lines.push('');
lines.push(
  `export const SALES_MATCH_DATA_VERSION = ${JSON.stringify({ phien_ban: d.phien_ban, ngay: d.ngay })} as const;`,
);
lines.push('');
lines.push('export const SALES_MATCH_CONSTANTS = {');
for (const [k, v] of Object.entries(d.hang_so)) {
  lines.push(`  ${k}: ${JSON.stringify(v)},`);
}
lines.push('} as const;');
lines.push('');
lines.push(`export const PRODUCT_MATCH_CODES = ${JSON.stringify(d.san_pham.ma_tran.nhan)} as const;`);
lines.push('');
lines.push('export const PRODUCT_MATCH_NAMES: Record<(typeof PRODUCT_MATCH_CODES)[number], string> = {');
for (const item of d.san_pham.danh_muc) {
  lines.push(`  ${JSON.stringify(item.ma)}: ${JSON.stringify(item.ten)},`);
}
lines.push('};');
lines.push('');
lines.push(
  'export const PRODUCT_MATCH_CLUSTER: Record<(typeof PRODUCT_MATCH_CODES)[number], number | null> = {',
);
for (const item of d.san_pham.danh_muc) {
  lines.push(`  ${JSON.stringify(item.ma)}: ${JSON.stringify(item.cum_chuyen_mon)},`);
}
lines.push('};');
lines.push('');

function matrix(name, values) {
  lines.push(`export const ${name}: readonly (readonly number[])[] = [`);
  for (const row of values) {
    lines.push(`  [${row.join(', ')}],`);
  }
  lines.push('];');
  lines.push('');
}

matrix('PRODUCT_SIMILARITY_MATRIX', d.san_pham.ma_tran.gia_tri);
matrix('CUSTOMER_SEGMENT_SIMILARITY_MATRIX', d.nhom_khach_hang.ma_tran.gia_tri);
matrix('DEAL_TYPE_SIMILARITY_MATRIX', d.giai_phap.ma_tran.gia_tri);
matrix('REGION_SIMILARITY_MATRIX', d.khu_vuc.ma_tran.gia_tri);
matrix('INDUSTRY_CLUSTER_SIMILARITY_MATRIX', d.nganh.ma_tran_cum.gia_tri);

if (d.dia_diem?.tinh_sang_mien) {
  lines.push(
    `export const PROVINCE_TO_MACRO_REGION = ${JSON.stringify(d.dia_diem.tinh_sang_mien, null, 2)} as const;`,
  );
  lines.push('');
}

if (d.chuyen_nganh?.tu_khoa) {
  lines.push(
    `export const MAJOR_KEYWORDS_KY_THUAT = ${JSON.stringify(d.chuyen_nganh.tu_khoa.ky_thuat)} as const;`,
  );
  lines.push('');
  lines.push(
    `export const MAJOR_KEYWORDS_KINH_TE = ${JSON.stringify(d.chuyen_nganh.tu_khoa.kinh_te)} as const;`,
  );
  lines.push('');
}

const out = path.join(__dirname, '..', 'sales-matching-tables.ts');
fs.writeFileSync(out, `${lines.join('\n')}\n`, 'utf8');
console.log('wrote', out);
