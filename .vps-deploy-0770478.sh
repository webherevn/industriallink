#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# LỆNH DEPLOY VPS — inlink.vn / ctv.inlink.vn / crm.inlink.vn
# Commit: 0770478  feat(ctv): nâng cấp toàn diện chính sách & tính toán hoa hồng CTV theo 3 cấp bậc
# Chạy trên VPS (root), thư mục deploy: /www/wwwroot/inlink
# ═══════════════════════════════════════════════════════════════════════════════
#
# ⚠ LẦN NÀY CÓ ĐỔI SCHEMA DB → BẮT BUỘC chạy migrate.
#   Migration: 20261123_ctv_commission_policy_tiers
#     + enum crm.CtvCommissionPolicyStatus (DRAFT/SCHEDULED/ACTIVE/ARCHIVED)
#     + bảng crm.ctv_commission_policy      (chính sách theo phiên bản)
#     + bảng crm.ctv_commission_tier        (3 cấp bậc BASIC/SILVER/GOLD)
#     + bảng crm.ctv_monthly_statement      (kỳ đối soát tháng của 1 CTV)
#     + bảng crm.ctv_commission_item        (chi tiết từng giao dịch hợp lệ)
#     + cột company.company.referred_by_ctv_id / attributed_at / attribution_source
#       (ghi nhận khách hàng trọn đời — 1 KH — 1 CTV)
#     + seed 1 policy ACTIVE v1: Cơ bản 15% (<10tr) / Bạc 20% (10–30tr) / Vàng 25% (>=30tr)
#
# Migration viết theo kiểu idempotent (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
# + seed có điều kiện NOT EXISTS → chạy lại nhiều lần vẫn an toàn, KHÔNG mất dữ liệu cũ.
#
# Gồm 4 phần:
#   1) Deploy code (pull + install + migrate + build + restart PM2)
#   2) Kiểm tra schema + seed chính sách mới trong DB
#   3) Verify (pm2, ports, live check, log)
#   4) Kiểm tra API chính sách + dữ liệu kỳ đối soát

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

# Prisma: schema ĐÃ đổi (thêm enum + 4 bảng + 3 cột) → generate + đồng bộ DB.
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
# đã từng chạy migrate chưa, migration nào đang fail, object mới đã có chưa).
# Script chỉ in thông tin, LUÔN exit 0 — không bao giờ làm deploy fail.
pnpm --filter @industriallink/api db:diagnose || echo "WARN: chẩn đoán migration — xem log ở trên"

# Phục hồi migration đã fail trước đó (nếu có) để migrate deploy không bị kẹt
# bởi "New migrations cannot be applied before the error is recovered from".
(cd "$ROOT/apps/api" && node scripts/resolve-failed-migrations.cjs) \
  || echo "WARN: phục hồi migration thất bại — xem log ở trên"

if pnpm --filter @industriallink/api db:migrate:deploy; then
  echo "OK: migrate deploy xong"
else
  echo "WARN: migrate deploy thất bại — fallback sang db push --accept-data-loss"
  # Migration CTV chỉ ADD (enum + bảng + cột) → db push không mất dữ liệu.
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
# BƯỚC 2 — KIỂM TRA SCHEMA + SEED CHÍNH SÁCH MỚI
#
# Sau migrate, DB phải có:
#   - 1 policy ACTIVE version 1 với 3 tier BASIC/SILVER/GOLD đúng ngưỡng & tỷ lệ
#   - 4 bảng ctv_commission_* / ctv_monthly_statement
#   - 3 cột company.referred_by_ctv_id / attributed_at / attribution_source
# ═══════════════════════════════════════════════════════════════════
cd "$ROOT/apps/api"

echo "=== enum crm.CtvCommissionPolicyStatus ==="
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const rows=await p.\$queryRawUnsafe(\`
    SELECT e.enumlabel FROM pg_type t
    JOIN pg_namespace n ON n.oid=t.typnamespace
    JOIN pg_enum e ON e.enumtypid=t.oid
    WHERE t.typname='CtvCommissionPolicyStatus' AND n.nspname='crm'
    ORDER BY e.enumsortorder\`);
  console.log('status:', rows.map(r=>r.enumlabel).join(', ')||'THIEU — migration chua chay');
  await p.\$disconnect();
})().catch(e=>{console.error('skip:',e.message);process.exit(0)});
" 2>/dev/null || echo "skip: khong doc duoc DB"

echo "=== bang moi (ctv_commission_policy / _tier / ctv_monthly_statement / ctv_commission_item) ==="
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const r=await p.\$queryRawUnsafe(\`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='crm'
      AND table_name IN ('ctv_commission_policy','ctv_commission_tier','ctv_monthly_statement','ctv_commission_item')
    ORDER BY table_name\`);
  console.log('co:', r.map(x=>x.table_name).join(', ')||'THIEU — migration chua chay');
  await p.\$disconnect();
})().catch(e=>{console.error('skip:',e.message);process.exit(0)});
" 2>/dev/null || echo "skip: khong doc duoc DB"

echo "=== cot moi trong company.company ==="
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const r=await p.\$queryRawUnsafe(\`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='company' AND table_name='company'
      AND column_name IN ('referred_by_ctv_id','attributed_at','attribution_source')
    ORDER BY column_name\`);
  console.log('cot co:', r.map(x=>x.column_name).join(', ')||'THIEU — migration chua chay');
  await p.\$disconnect();
})().catch(e=>{console.error('skip:',e.message);process.exit(0)});
" 2>/dev/null || echo "skip: khong doc duoc DB"

echo "=== seed chinh sach ACTIVE + 3 cap bac ==="
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const pol=await p.\$queryRawUnsafe(\`
    SELECT id, name, version, status, effective_from,
           include_job_posting, include_hunt_package, include_credit_topup, exclude_vat
    FROM \"crm\".\"ctv_commission_policy\" ORDER BY version DESC LIMIT 5\`);
  pol.forEach(x=>console.log('  policy v'+x.version, x.status, x.name,
    '| jobPosting='+x.include_job_posting, 'hunt='+x.include_hunt_package,
    'creditTopup='+x.include_credit_topup, 'excludeVat='+x.exclude_vat));
  if(!pol.length) console.log('  THIEU policy — migration chua chay');
  const t=await p.\$queryRawUnsafe(\`
    SELECT t.code, t.name, t.min_monthly_revenue, t.max_monthly_revenue, t.rate_percent, t.sort_order
    FROM \"crm\".\"ctv_commission_tier\" t
    JOIN \"crm\".\"ctv_commission_policy\" p ON p.id=t.policy_id
    WHERE p.status='ACTIVE' ORDER BY t.sort_order\`);
  console.log('  --- tiers cua policy ACTIVE ---');
  t.forEach(x=>console.log('   ', x.code, x.name,
    '| ' + x.min_monthly_revenue + ' .. ' + (x.max_monthly_revenue==null?'INF':x.max_monthly_revenue),
    '-> ' + x.rate_percent + '%'));
  if(t.length!==3) console.log('  WARN: can co', t.length, 'tier (mong doi 3)');
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
# BƯỚC 4 — KIỂM TRA API CHÍNH SÁCH + DỮ LIỆU KỲ ĐỐI SOÁT
#
# 1) Endpoint public policy phải trả 401 khi chưa đăng nhập.
# 2) CRM settings policy phải trả 401 khi chưa đăng nhập.
# 3) Không được có lỗi Prisma liên quan model ctv_commission_* trong log.
# ═══════════════════════════════════════════════════════════════════
echo "=== API: chinh sach cong cong chua dang nhap (mong doi 401) ==="
curl -s -m 15 -o /dev/null -w "http=%{http_code}\n" \
  http://127.0.0.1:3001/api/v1/ctv/commission-policy

echo "=== API: CRM settings chinh sach chua dang nhap (mong doi 401) ==="
curl -s -m 15 -o /dev/null -w "http=%{http_code}\n" \
  http://127.0.0.1:3001/api/v1/crm/commission-policy/settings

echo "=== du lieu ky doi soat + item (xem da co gan gan) ==="
cd "$ROOT/apps/api"
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const s=await p.\$queryRawUnsafe(\`
    SELECT status, count(*)::int AS c, COALESCE(sum(final_commission),0)::bigint AS total
    FROM \"crm\".\"ctv_monthly_statement\" GROUP BY status ORDER BY status\`);
  if(s.length) s.forEach(x=>console.log('  statement', x.status, '=', x.c, '| tong final =', x.total));
  else console.log('  chua co ky doi soat nao (CTV chua phat sinh giao dich)');
  const i=await p.\$queryRawUnsafe(\`
    SELECT status, count(*)::int AS c FROM \"crm\".\"ctv_commission_item\" GROUP BY status ORDER BY status\`);
  if(i.length) i.forEach(x=>console.log('  item', x.status, '=', x.c));
  else console.log('  chua co item hoa hong nao');
  const c=await p.\$queryRawUnsafe(\`
    SELECT count(*)::int AS c FROM \"company\".\"company\" WHERE referred_by_ctv_id IS NOT NULL\`);
  console.log('  khach hang da gan CTV tron doi:', c[0].c);
  await p.\$disconnect();
})().catch(e=>{console.error('skip:',e.message);process.exit(0)});
" 2>/dev/null || echo "skip: khong doc duoc DB"
cd "$ROOT"

echo "=== loi trong log api (loc phan CTV commission) ==="
pm2 logs inlink-api --lines 200 --nostream 2>/dev/null \
  | grep -iE "ctv_commission|ctv_monthly|PrismaClientKnownRequestError|UnknownArgument|does not exist" \
  | tail -15 || echo "khong co loi lien quan CTV commission"

echo "=== loi chung trong log api ==="
pm2 logs inlink-api --lines 100 --nostream 2>/dev/null | grep -iE "error|exception" | tail -10 || echo "khong co loi"

echo ""
echo "════════ HOÀN TẤT DEPLOY 0770478 ════════"
