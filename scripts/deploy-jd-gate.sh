#!/usr/bin/env bash
# Deploy web + xác minh BUILD_ID đổi (chống serve .next cũ).
set -euo pipefail
export PATH="/www/server/nodejs/v24.14.0/bin:${PATH:-}"

ROOT="/www/wwwroot/inlink"
cd "$ROOT"

git config --global --add safe.directory "$ROOT" || true
git fetch origin
git reset --hard origin/main
echo "GIT=$(git log -1 --oneline)"

# Bắt buộc source mới
grep -q 'jd-company-gate-v2' apps/web/src/app/jobs/new/page.tsx \
  || { echo "FAIL: source thiếu jd-company-gate-v2"; exit 1; }

OLD_ID="$(cat apps/web/.next/BUILD_ID 2>/dev/null || echo none)"
echo "OLD_BUILD_ID=$OLD_ID"

rm -rf apps/web/.next
# Xóa cache webpack/turbo có thể giữ chunk cũ
rm -rf apps/web/node_modules/.cache 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true

pnpm --filter @industriallink/web build

NEW_ID="$(cat apps/web/.next/BUILD_ID)"
echo "NEW_BUILD_ID=$NEW_ID"

if [ "$NEW_ID" = "$OLD_ID" ]; then
  echo "FAIL: BUILD_ID không đổi — build không ghi .next mới"
  exit 1
fi

if [ "$NEW_ID" = "IRm3NG6Gx9rvK_O2ulDc5" ]; then
  echo "FAIL: vẫn BUILD_ID cũ IRm3NG6Gx9rvK_O2ulDc5"
  exit 1
fi

grep -R "jd-company-gate-v2" apps/web/.next --include='*.js' -l | head -3 \
  || { echo "FAIL: bundle thiếu jd-company-gate-v2"; exit 1; }
echo "OK: bundle có jd-company-gate-v2"

chown -R www:www apps/web/.next 2>/dev/null || true

# Restart đúng process, cwd = monorepo root
pm2 delete inlink-web 2>/dev/null || true
pm2 start "pnpm --filter @industriallink/web exec next start -p 3000" \
  --name inlink-web \
  --cwd "$ROOT"
pm2 save
sleep 4

echo "=== pm2 ==="
pm2 show inlink-web | grep -E 'status|uptime|restarts|exec cwd|script' || true

echo "=== localhost BUILD comment ==="
LIVE="$(curl -s http://127.0.0.1:3000/jobs/new || true)"
echo "$LIVE" | grep -oE '<!--[A-Za-z0-9_-]+-->' | head -1 || echo "(no comment)"
echo "$LIVE" | grep -o 'jd-company-gate-v2' | head -1 || echo "(marker chưa trong HTML SSR — ok nếu có trong JS)"

# Chunk phải chứa marker
CHUNK="$(echo "$LIVE" | grep -oE 'jobs/new/page-[a-f0-9]+\.js' | head -1 || true)"
echo "CHUNK=$CHUNK"
if [ -n "$CHUNK" ]; then
  curl -s "http://127.0.0.1:3000/_next/static/chunks/app/$CHUNK" \
    | grep -o 'jd-company-gate-v2' | head -1 \
    || { echo "FAIL: chunk live thiếu jd-company-gate-v2"; exit 1; }
  echo "OK: localhost chunk có jd-company-gate-v2"
fi

echo "DONE. Mở https://tuyendung.inlink.vn/jobs/new → Ctrl+Shift+R"
echo "Nếu domain vẫn build cũ trong khi localhost OK → xóa cache nginx/Cloudflare."
