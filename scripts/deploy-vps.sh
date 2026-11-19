#!/usr/bin/env bash
# Deploy chuẩn IndustrialLink trên VPS aaPanel (inlink.vn).
# Gồm: pull code → install → prisma generate + db push → build contracts/vn-admin
#       → build web + api → restart PM2 → verify.
set -euo pipefail

export PATH="/www/server/nodejs/v24.14.0/bin:${PATH:-}"

ROOT="/www/wwwroot/inlink"
cd "$ROOT"

git config --global --add safe.directory "$ROOT" || true
git fetch origin
git reset --hard origin/main
echo "GIT=$(git log -1 --oneline)"

# 1) Cài dependency
pnpm install --frozen-lockfile

# 2) Prisma: generate client + đồng bộ schema.
#    Ưu tiên `prisma migrate deploy` (đọc prisma/migrations — có lịch sử, rollback được).
#    Nếu lỗi vì DB production chưa từng chạy migrate (drift), fallback sang
#    `db push --accept-data-loss` để đồng bộ schema nhanh (cần --accept-data-loss vì các
#    refactor có DROP bảng cũ: billing_sourcing_usage / _engagement / _package).
pnpm --filter @industriallink/api db:generate
# 2a) Phục hồi migration đã fail (nếu có) để `migrate deploy` không bị chặn bởi
#     lỗi "New migrations cannot be applied before the error is recovered from".
#     Script tự quyết định: schema đã khớp → --applied, chưa khớp → --rolled-back (chạy lại).
(cd "$ROOT/apps/api" && node scripts/resolve-failed-migrations.cjs) \
  || echo "WARN: phuc hoi migration that bac — xem log o tren"
if ! pnpm --filter @industriallink/api db:migrate:deploy; then
  echo "WARN: migrate deploy thất bại — fallback sang db push --accept-data-loss"
  pnpm --filter @industriallink/api db:push
fi

# 3) Build packages dùng chung TRƯỚC (dist bị .gitignore — bỏ qua bước này sẽ dẫn tới
#    TS error kiểu contracts cũ, vd "Property 'jobPackageName' does not exist on type 'JobListItem'")
pnpm --filter @industriallink/contracts build
pnpm --filter @industriallink/vn-admin build

# 4) Build web + api
rm -rf apps/web/.next
pnpm --filter @industriallink/web build
pnpm --filter @industriallink/api build

# 5) Restart PM2 (KHÔNG pkill)
pm2 restart inlink-api || pm2 restart all || true
pm2 restart inlink-web || pm2 restart all || true
pm2 save || true
sleep 3

# 6) Verify
echo "=== pm2 ==="
pm2 status

echo "=== ports ==="
ss -ltnp 2>/dev/null | grep -E ':(3000|3001)\b' || echo "WARN: thiếu port 3000/3001"

echo "=== db schema check ==="
# Verify các bảng mới của refactor Săn nhân sự đã tồn tại trong DB production
# Chạy từ apps/api để Node resolve được @prisma/client (pnpm symlink nằm ở đó).
(cd "$ROOT/apps/api" && node scripts/check-hunt-schema.cjs) \
  || echo "WARN: kiểm tra schema DB thất bại — xem log ở trên"

echo "=== live check ==="
curl -sI -m 10 https://inlink.vn/ | head -1 || true
curl -sI -m 10 http://127.0.0.1:3001/api/v1/cms/site-code | head -1 || true

echo "=== log tail ==="
pm2 logs inlink-api --lines 30 --nostream 2>/dev/null || true
