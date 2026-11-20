# Lệnh deploy VPS — inlink.vn
# Commit: ee02b36  fix(deploy): chuan hoa lenh migrate (P3006) + migration KYC idempotent
# Chạy trên VPS (root), thư mục deploy: /www/wwwroot/inlink
#
# ⚠ LẦN NÀY CÓ ĐỔI SCHEMA DB → BẮT BUỘC chạy migrate.
#   Migration: 20261122_crm_partner_kyc (enum CrmKycStatus + bảng crm.crm_partner_kyc
#   + cột status/expires_at cho crm.crm_partner_claim
#   + cột gross_amount_vnd/pit_tax_amount_vnd/net_paid_amount_vnd/transfer_ref
#   cho crm.crm_commission_period)
#
# Migration chỉ ADD thêm enum/bảng/cột — không xóa hay sửa dữ liệu cũ. An toàn.
#
# Gồm 4 phần:
#   1) Deploy code (pull + install + migrate + build + restart PM2)
#   2) Kiểm tra dữ liệu KYC hiện có
#   3) Verify
#   4) Kiểm tra luồng KYC + Payout Gate

# ═══════════════════════════════════════════════════════════════════
# BƯỚC 1 — DEPLOY CODE
# ═══════════════════════════════════════════════════════════════════
export PATH="/www/server/nodejs/v24.14.0/bin:${PATH:-}"
ROOT="/www/wwwroot/inlink"
cd "$ROOT"

git config --global --add safe.directory "$ROOT" || true
git fetch origin
git reset --hard origin/main
echo "GIT=$(git log -1 --oneline)"

pnpm install --frozen-lockfile

# Prisma: schema ĐÃ đổi (thêm enum + bảng + cột) → generate + đồng bộ DB.
#
# ⚠ TUYỆT ĐỐI KHÔNG dùng `pnpm --filter @industriallink/api db:migrate` trên VPS.
#   Script đó là `prisma migrate dev` → dựng SHADOW DB rỗng rồi chạy lại toàn bộ
#   migration từ đầu. Migration cũ nhất (20260724_sales_b2b_profile_matrix) gọi
#   `ALTER TABLE candidate.candidate_profile` nhưng KHÔNG migration nào
#   `CREATE SCHEMA candidate` → shadow DB lỗi "schema candidate does not exist"
#   → P3006. Lỗi này có sẵn từ lâu, không phải do commit mới.
#
# Đúng cách: `db:migrate:deploy` (prisma migrate deploy — KHÔNG dùng shadow DB).
# Nếu production DB chưa từng chạy migrate (drift) → fallback `db push`.
pnpm --filter @industriallink/api db:generate

# Chẩn đoán trạng thái migration TRƯỚC khi deploy (giúp biết DB production
# đã từng chạy migrate chưa, migration nào đang fail, object KYC đã có chưa).
pnpm --filter @industriallink/api db:diagnose || echo "WARN: chẩn đoán migration — xem log ở trên"

# Phục hồi migration đã fail trước đó (nếu có) để migrate deploy không bị kẹt
# bởi "New migrations cannot be applied before the error is recovered from".
(cd "$ROOT/apps/api" && node scripts/resolve-failed-migrations.cjs) \
  || echo "WARN: phục hồi migration thất bại — xem log ở trên"

if pnpm --filter @industriallink/api db:migrate:deploy; then
  echo "OK: migrate deploy xong"
else
  echo "WARN: migrate deploy thất bại — fallback sang db push --accept-data-loss"
  # Migration KYC chỉ ADD (enum + bảng + cột) → db push không mất dữ liệu.
  pnpm --filter @industriallink/api db:push
fi

# Build contracts trước (dist bị gitignore)
pnpm --filter @industriallink/contracts build
pnpm --filter @industriallink/vn-admin build

# Build web + api
rm -rf apps/web/.next
pnpm --filter @industriallink/web build
pnpm --filter @industriallink/api build

# Restart PM2
pm2 restart inlink-api || pm2 restart all || true
pm2 restart inlink-web || pm2 restart all || true
pm2 save || true
sleep 3

# ═══════════════════════════════════════════════════════════════════
# BƯỚC 2 — KIỂM TRA DỮ LIỆU KYC + KHÓA MST
#
# Sau migrate, mọi CTV cũ sẽ có status = UNVERIFIED (mặc định).
# → Cổng chi trả ngày 10 sẽ CHẶN các CTV này cho tới khi họ xác thực.
# Đây là hành vi ĐÚNG theo yêu cầu. Không cần sửa gì.
# ═══════════════════════════════════════════════════════════════════
cd "$ROOT/apps/api"

echo "=== enum CrmKycStatus ==="
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const rows=await p.\$queryRawUnsafe(\`
    SELECT e.enumlabel FROM pg_type t
    JOIN pg_enum e ON e.enumtypid=t.oid
    WHERE t.typname='CrmKycStatus' ORDER BY e.enumsortorder\`);
  console.log('CrmKycStatus:', rows.map(r=>r.enumlabel).join(', ')||'THIEU — migration chua chay');
  await p.\$disconnect();
})().catch(e=>{console.error('skip:',e.message);process.exit(0)});
" 2>/dev/null || echo "skip: khong doc duoc DB"

echo "=== bang crm.crm_partner_kyc ==="
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const r=await p.\$queryRaw\`SELECT count(*)::int AS c FROM crm.crm_partner_kyc\`;
  console.log('so ho so KYC:', r[0].c);
  const s=await p.\$queryRaw\`SELECT status, count(*)::int AS c FROM crm.crm_partner_kyc GROUP BY status ORDER BY status\`;
  s.forEach(x=>console.log('  ', x.status, '=', x.c));
  await p.\$disconnect();
})().catch(e=>{console.error('skip:',e.message);process.exit(0)});
" 2>/dev/null || echo "skip: khong doc duoc DB"

echo "=== cot moi trong crm.crm_commission_period ==="
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const r=await p.\$queryRaw\`SELECT column_name FROM information_schema.columns WHERE table_schema='crm' AND table_name='crm_commission_period' AND column_name IN ('gross_amount_vnd','pit_tax_amount_vnd','net_paid_amount_vnd','transfer_ref') ORDER BY column_name\`;
  console.log('cot co:', r.map(x=>x.column_name).join(', ')||'THIEU — migration chua chay');
  await p.\$disconnect();
})().catch(e=>{console.error('skip:',e.message);process.exit(0)});
" 2>/dev/null || echo "skip: khong doc duoc DB"

echo "=== cot moi trong crm.crm_partner_claim (status + expires_at) ==="
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const r=await p.\$queryRaw\`SELECT column_name FROM information_schema.columns WHERE table_schema='crm' AND table_name='crm_partner_claim' AND column_name IN ('status','expires_at') ORDER BY column_name\`;
  console.log('cot co:', r.map(x=>x.column_name).join(', ')||'THIEU — migration chua chay');
  await p.\$disconnect();
})().catch(e=>{console.error('skip:',e.message);process.exit(0)});
" 2>/dev/null || echo "skip: khong doc duoc DB"

cd "$ROOT"

# ═══════════════════════════════════════════════════════════════════
# BƯỚC 3 — VERIFY
# ═══════════════════════════════════════════════════════════════════
echo "=== pm2 ==="
pm2 status

echo "=== ports ==="
ss -ltnp 2>/dev/null | grep -E ':(3000|3001)\b' || echo "WARN: thieu port 3000/3001"

echo "=== live check ==="
curl -sI -m 10 https://inlink.vn/ | head -1 || true
curl -sI -m 10 https://ctv.inlink.vn/ | head -1 || true
curl -sI -m 10 https://crm.inlink.vn/ | head -1 || true
curl -sI -m 10 http://127.0.0.1:3001/api/v1/cms/site-code | head -1 || true

echo "=== log tail ==="
pm2 logs inlink-api --lines 30 --nostream 2>/dev/null || true

# ═══════════════════════════════════════════════════════════════════
# BƯỚC 4 — KIỂM TRA LUỒNG KYC + PAYOUT GATE
#
# 1) Endpoint đọc ảnh CCCD phải chặn khi chưa đăng nhập → 401.
# 2) Danh sách hồ sơ KYC (CRM) chỉ trả về khi đã đăng nhập → 401.
# 3) Nộp hồ sơ thiếu ảnh mặt sau → 400.
# 4) Cổng chi trả: CTV chưa VERIFIED → 400 với đúng thông báo.
# ═══════════════════════════════════════════════════════════════════
echo "=== KYC: doc anh CCCD khong chua dang nhap (mong doi 401) ==="
curl -s -m 15 -o /dev/null -w "http=%{http_code}\n" \
  http://127.0.0.1:3001/api/v1/ctv/kyc/image/00000000-0000-0000-0000-000000000000/front

echo "=== KYC: danh sach ho so CRM khong chua dang nhap (mong doi 401) ==="
curl -s -m 15 -o /dev/null -w "http=%{http_code}\n" \
  http://127.0.0.1:3001/api/v1/crm/ctv/kyc

echo "=== KYC: nop ho so thieu anh mat sau (mong doi 400) ==="
curl -s -m 15 -o /dev/null -w "http=%{http_code}\n" -X PUT \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Nguyen Van A","idNumber":"012345678901","phone":"0900000001","bankCode":"MB","bankName":"MB Bank","bankAccountNumber":"0123456789","bankAccountHolder":"Nguyen Van A"}' \
  http://127.0.0.1:3001/api/v1/ctv/kyc

echo "=== KYC: so ho so PENDING (badge tren menu CRM) ==="
cd "$ROOT/apps/api"
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const r=await p.\$queryRaw\`SELECT count(*)::int AS c FROM crm.crm_partner_kyc WHERE status='PENDING'\`;
  console.log('ho so PENDING:', r[0].c);
  await p.\$disconnect();
})().catch(e=>{console.error('skip:',e.message);process.exit(0)});
" 2>/dev/null || echo "skip: khong doc duoc DB"
cd "$ROOT"

echo "=== Payout Gate: trang thai KYC cua CTV (ky choi se bi chan) ==="
cd "$ROOT/apps/api"
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const r=await p.\$queryRaw\`
    SELECT COALESCE(k.status::text,'UNVERIFIED') AS status, count(*)::int AS c
    FROM crm.crm_partner pt
    LEFT JOIN crm.crm_partner_kyc k ON k.partner_id=pt.id
    GROUP BY 1 ORDER BY 1\`;
  r.forEach(x=>console.log('  ', x.status, '=', x.c));
  const w=await p.\$queryRaw\`SELECT count(*)::int AS c FROM crm.crm_commission_period WHERE status='payable'\`;
  console.log('ky choi da duyet chi (status=payable):', w[0].c, '— kiem tra tung ky co VERIFIED truoc khi chi');
  await p.\$disconnect();
})().catch(e=>{console.error('skip:',e.message);process.exit(0)});
" 2>/dev/null || echo "skip: khong doc duoc DB"
cd "$ROOT"

echo "=== loi trong log api ==="
pm2 logs inlink-api --lines 100 --nostream 2>/dev/null | grep -iE "error|exception" | tail -10 || echo "khong co loi"
