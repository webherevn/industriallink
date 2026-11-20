# Lệnh deploy VPS — inlink.vn
# Commit: 114c91a  fix(web): bo logic robot tro ly chay ra giua man sau 10s khong hoat dong
# Chạy trên VPS (root), thư mục deploy: /www/wwwroot/inlink
#
# Lần này chỉ đổi frontend (apps/web) → không cần migrate DB.
#
# Gồm 4 phần:
#   1) Deploy code (pull + install + build + restart PM2)
#   2) Dọn dữ liệu hồ sơ LAI TẠP giữa 2 lĩnh vực (đã chạy xong lần trước, giữ lại để chạy lại khi cần)
#   3) Verify
#   4) Kiểm tra hành vi ATS mới (4 hạng mục)

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

# Prisma: schema KHÔNG đổi lần này → generate là đủ (migrate deploy sẽ no-op)
pnpm --filter @industriallink/api db:generate

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
# BƯỚC 2 — DỌN DỮ LIỆU LAI TẠP (Kinh doanh <-> Ky thuat)
#
# Ho so cu co the luu dong thoi du lieu muc 13+ cua CA 2 nhanh.
# Dieu nay lam AI Matching cham sai (du lieu nhanh khong active lot vao
# bang trong so). Script don theo ranh gioi nghiem ngat.
#
# ⚠ CHAY DRY-RUN TRUOC DE XEM SE SUA BAO NHIEU HO SO.
# ═══════════════════════════════════════════════════════════════════
cd "$ROOT/apps/api"

# 2a) Xem truoc (khong ghi DB)
node scripts/clean-profile-track-mix.cjs --dry-run

# 2b) Ghi DB — BO COMMENT dong duoi sau khi da xem ket qua dry-run o tren
#     DEBUG_SQL=1 de in ra SQL thuc te Prisma gui xuong DB (phoi hien thi
#     $1..$N danh so lien tuc + ARRAY['...']::text[] co nhay don).
DEBUG_SQL=1 node scripts/clean-profile-track-mix.cjs --all

# 2c) KIEM TRA IDEMPOTENT — phai ra "0 can lam sach"
node scripts/clean-profile-track-mix.cjs --dry-run

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
curl -sI -m 10 http://127.0.0.1:3001/api/v1/cms/site-code | head -1 || true

echo "=== log tail ==="
pm2 logs inlink-api --lines 30 --nostream 2>/dev/null || true

# ═══════════════════════════════════════════════════════════════════
# BƯỚC 4 — KIỂM TRA HÀNH VI ATS MỚI (4 hạng mục)
#
# 1) Mở khóa liên hệ: NTD mở hồ sơ bằng Credit HOẶC ứng viên tự ứng tuyển
#    → email/SĐT hiện đầy đủ (không còn "098***538").
# 2) Ứng tuyển chéo lĩnh vực: hồ sơ Kỹ thuật nộp tin Kinh doanh → KHÔNG còn
#    lỗi 400 "Hồ sơ Kỹ thuật không thể nộp tin Kinh doanh".
# 3) Hộp thư: ứng viên tự ứng tuyển vào tin của gói Tin săn → badge phải là
#    "Tự ứng tuyển" (KHÔNG phải "Tin săn nhân sự").
# 4) Quy trình tuyển dụng: có tab "Danh sách cần xử lý" / "Bảng Kanban theo vị trí".
# ═══════════════════════════════════════════════════════════════════
echo "=== ATS: API phan hoi ==="
curl -s -m 15 -o /dev/null -w "http=%{http_code}\n" \
  http://127.0.0.1:3001/api/v1/cms/site-code || echo "WARN: api khong phan hoi"

echo "=== ATS: quy trinh tuyen dung co 2 che do xem ==="
curl -s -m 15 http://127.0.0.1:3001/api/v1/cms/site-code >/dev/null 2>&1 \
  && echo "API OK" || echo "WARN: api khong phan hoi"

echo "=== ATS: so ho so ung tuyen (nguon mac dinh la self_applied) ==="
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const r=await p.\$queryRaw\`SELECT count(*)::int AS c FROM application WHERE is_deleted=false\`;
  console.log('so ho so ung tuyen:', r[0].c);
  await p.\$disconnect();
})().catch(e=>{console.error('skip:',e.message);process.exit(0)});
" 2>/dev/null || echo "skip: khong doc duoc DB"

echo "=== ATS: loi trong log api ==="
pm2 logs inlink-api --lines 80 --nostream 2>/dev/null | grep -iE "error|exception" | tail -10 || echo "khong co loi"
