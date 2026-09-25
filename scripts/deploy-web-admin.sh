#!/usr/bin/env bash
# Deploy web (Next) cho inlink — chạy trên VPS trong thư mục repo.
set -euo pipefail

export PATH="/www/server/nodejs/v24.14.0/bin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "REPO=$ROOT"

git config --global --add safe.directory "$ROOT" || true
git fetch origin
git reset --hard origin/main
echo "GIT=$(git log -1 --oneline)"

# Source phải có marker
if ! grep -q 'admin-login-v3' apps/web/src/app/login/page.tsx; then
  echo "FAIL: source thiếu admin-login-v3"
  exit 1
fi
echo "OK: source có admin-login-v3"

mkdir -p apps/web
cat > apps/web/.env.production << 'EOF'
NEXT_PUBLIC_SITE_URL=https://inlink.vn
NEXT_PUBLIC_RECRUITER_SITE_URL=https://tuyendung.inlink.vn
NEXT_PUBLIC_ADMIN_SITE_URL=https://admin.inlink.vn
EOF

sed -i '/^NEXT_PUBLIC_API_URL=/d' .env 2>/dev/null || true
grep -q '^ADMIN_WEB_ORIGIN=' .env 2>/dev/null || echo 'ADMIN_WEB_ORIGIN=https://admin.inlink.vn' >> .env
grep -q '^RECRUITER_WEB_ORIGIN=' .env 2>/dev/null || echo 'RECRUITER_WEB_ORIGIN=https://tuyendung.inlink.vn' >> .env
grep -q '^WEB_ORIGIN=' .env 2>/dev/null || echo 'WEB_ORIGIN=https://inlink.vn' >> .env
grep -q '^AUTH_COOKIE_DOMAIN=' .env 2>/dev/null || echo 'AUTH_COOKIE_DOMAIN=.inlink.vn' >> .env

rm -rf apps/web/.next

# ĐÚNG tên package — "web" không khớp @industriallink/web
echo "Building @industriallink/web ..."
pnpm --filter @industriallink/web build

if [ ! -d apps/web/.next ]; then
  echo "FAIL: không có apps/web/.next sau build"
  exit 1
fi

if ! grep -R "admin-login-v3" apps/web/.next --include='*.js' --include='*.html' --include='*.rsc' -l | head -5; then
  echo "FAIL: bundle thiếu admin-login-v3"
  exit 1
fi
echo "OK: bundle có admin-login-v3"

chown -R www:www apps/web/.next 2>/dev/null || true

# Chỉ restart PM2 — KHÔNG pkill (tránh giết process vừa start)
if command -v pm2 >/dev/null 2>&1; then
  pm2 describe inlink-web >/dev/null 2>&1 && pm2 restart inlink-web || pm2 restart all || true
  sleep 2
  pm2 list || true
  pm2 show inlink-web 2>/dev/null | sed -n '1,40p' || true
fi

echo "LIVE check:"
curl -s https://admin.inlink.vn/login | grep -o 'admin-login-v3' | head -1 || echo "CHƯA thấy marker trên live — xem pm2 cwd có phải $ROOT không"
