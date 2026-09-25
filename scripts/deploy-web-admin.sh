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
pnpm --filter web build

if ! grep -R "admin-login-v3\|admin.inlink.vn" apps/web/.next --include='*.js' | head -3; then
  echo "FAIL: bundle thiếu admin marker — dừng lại"
  exit 1
fi
echo "OK: bundle có admin marker"

chown -R www:www apps/web/.next 2>/dev/null || true

# Restart Next trên :3000
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart inlink-web 2>/dev/null || pm2 restart all || true
  pm2 list || true
fi

# Kill stale next nếu cần (aaPanel sẽ tự start lại)
pkill -f "next start -p 3000" 2>/dev/null || true
sleep 1

echo "LIVE chunk:"
curl -s https://admin.inlink.vn/login | grep -oE 'login/page-[a-f0-9]+\.js' | head -1 || true
echo "Expect HTML chứa admin-login-v3 sau khi process mới lên:"
curl -s https://admin.inlink.vn/login | grep -o 'admin-login-v3' | head -1 || echo "(chưa thấy — Restart Node project web trên aaPanel rồi curl lại)"
