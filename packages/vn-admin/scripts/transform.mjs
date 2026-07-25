/**
 * Transform nguồn hành chính VN → JSON gọn cho runtime.
 *
 * Nguồn (đã tải vào scripts/ trước khi chạy):
 * - Cũ (trước 1/7/2025): daohoangson/dvhcvn v20250301 → sorted.json
 *   https://github.com/daohoangson/dvhcvn (CC0 / public domain data)
 * - Mới (sau sáp nhập 2025): open-admin-data/vietnam-administrative-divisions
 *   hierarchy.json — 34 tỉnh/thành + phường/xã
 *
 * Chạy: node scripts/transform.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'src', 'data');
mkdirSync(dataDir, { recursive: true });

const oldRaw = JSON.parse(readFileSync(join(__dirname, 'dvhcvn-old.json'), 'utf8'));
const newRaw = JSON.parse(readFileSync(join(__dirname, 'hierarchy-new.json'), 'utf8'));

/** @type {{ id: string; name: string }[]} */
const provincesOld = [];
/** @type {Record<string, { id: string; name: string }[]>} */
const districtsOld = {};

for (const row of oldRaw) {
  const [id, name, , , children] = row;
  provincesOld.push({ id: String(id), name: String(name) });
  districtsOld[String(id)] = (children || []).map((d) => ({
    id: String(d[0]),
    name: String(d[1]),
  }));
}

provincesOld.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

/** @type {{ id: string; name: string }[]} */
const provincesNew = [];
/** @type {Record<string, { id: string; name: string }[]>} */
const wardsNew = {};

for (const p of newRaw.data || []) {
  const id = String(p.id ?? p.code?.id);
  const name = String(p.name?.local ?? p.name);
  provincesNew.push({ id, name });
  wardsNew[id] = (p.ward || []).map((w) => ({
    id: String(w.id ?? w.code?.id),
    name: String(w.name?.local ?? w.name),
  }));
}

provincesNew.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

function write(name, value) {
  const path = join(dataDir, name);
  writeFileSync(path, `${JSON.stringify(value)}\n`, 'utf8');
  console.log(`wrote ${name} (${Buffer.byteLength(JSON.stringify(value))} bytes)`);
}

write('provinces-old.json', provincesOld);
write('districts-old.json', districtsOld);
write('provinces-new.json', provincesNew);
write('wards-new.json', wardsNew);

console.log(
  `old: ${provincesOld.length} provinces, ${Object.values(districtsOld).flat().length} districts`,
);
console.log(
  `new: ${provincesNew.length} provinces, ${Object.values(wardsNew).flat().length} wards`,
);
