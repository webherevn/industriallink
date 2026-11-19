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

# 2) Prisma: generate client + đồng bộ schema (migration mới đã nằm trong prisma/migrations)
pnpm --filter @industriallink/api db:generate
pnpm --filter @industriallink/api db:push

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

echo "=== live check ==="
curl -sI -m 10 https://inlink.vn/ | head -1 || true
curl -sI -m 10 http://127.0.0.1:3001/api/v1/cms/site-code | head -1 || true

echo "=== log tail ==="
pm2 logs inlink-api --lines 30 --nostream 2>/dev/null || true
