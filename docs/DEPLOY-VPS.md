# IndustrialLink — Triển khai trên VPS inlink.vn

Tài liệu này ghi lại cấu hình VPS thật + quy trình deploy an toàn. Repo: `https://github.com/webherevn/industriallink`, branch `main`.

---

## 1. Thông tin VPS

| Mục | Giá trị |
| --- | --- |
| Host | `Inlink` (root) |
| Domain | `inlink.vn` |
| Thư mục deploy | `/www/wwwroot/inlink` |
| Web server | Nginx (Aapanel — file log: `/www/wwwlogs/inlink.vn.error.log`) |
| Frontend | Next.js, port `3000` |
| Backend API | NestJS, port `3001` |
| Process manager | **PM2** (auto-start qua systemd) |
| Log API | `/var/log/inlink-api.log` (chỉ dùng nếu chạy ngoài PM2) |
| Database | PostgreSQL 16 + pgvector (multi-schema) |
| Cache / Queue | Redis + BullMQ |
| Object storage | MinIO (S3-compatible) |
| OpenSearch | full-text projection cho AI Search |
| `.env` | `/www/wwwroot/inlink/.env` (không commit lên git) |

---

## 2. Kiến trúc reverse proxy (Nginx)

```
Client → https://inlink.vn (Nginx TLS)
            ├── /api/*  ──► http://127.0.0.1:3001  (NestJS API)
            └── /*      ──► http://127.0.0.1:3000  (Next.js)
```

Nếu cả hai upstream đều listen thì mọi route sẽ 200. Một upstream chết → fallback `/502.html` của Next.js → 504 timeout. **Luôn đảm bảo cả 2 process PM2 `online`.**

---

## 3. Cài đặt lần đầu (đã chạy)

```bash
# Cài Node 20+, pnpm, PM2
npm i -g pnpm pm2

# Pull repo
cd /www/wwwroot
git clone https://github.com/webherevn/industriallink.git inlink
cd inlink
pnpm install

# File env (không commit)
cp .env.example .env && nano .env   # điền DATABASE_URL, REDIS_URL, OPENAI_API_KEY, ...

# Bật Prisma
pnpm db:push
pnpm db:seed

# Build cả hai
pnpm --filter web build
pnpm --filter @industriallink/api build
```

---

## 4. File `ecosystem.config.cjs` ở root repo

```js
module.exports = {
  apps: [
    {
      name: 'inlink-web',
      cwd: '/www/wwwroot/inlink/apps/web',
      script: 'pnpm',
      args: 'start',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production', PORT: 3000 },
    },
    {
      name: 'inlink-api',
      cwd: '/www/wwwroot/inlink',
      script: 'pnpm',
      args: '--filter @industriallink/api start',
      instances: 1,
      autorestart: true,
      max_memory_restart: '768M',
      env: { NODE_ENV: 'production', PORT: 3001 },
    },
  ],
};
```

Start & persist:

```bash
cd /www/wwwroot/inlink
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # → copy lệnh sudo env PATH=... mà PM2 in ra, chạy lại
pm2 save      # lưu lại lần nữa sau startup
```

---

## 5. Quy trình deploy chuẩn (Windows → GitHub → VPS)

### Bước 1 — Code trên Windows (PowerShell tại `C:\Users\hi\Projects\industriallink`)

```powershell
# Xem trạng thái
git status

# Add + commit (tách commit nhỏ, message rõ ràng)
git add -A
git commit -m "feat(web): mô tả ngắn thay đổi"

# Push lên GitHub
git push origin main
```

### Bước 2 — SSH lên VPS, pull code mới

```bash
ssh root@<VPS_IP>

cd /www/wwwroot/inlink
git status
git pull origin main
```

### Bước 3 — Cài dep mới (nếu có thay đổi `package.json`)

```bash
pnpm install
```

### Bước 4 — Build

| Thay đổi ở đâu | Lệnh build |
| --- | --- |
| `apps/web/**` | `pnpm --filter web build` |
| `apps/api/**` | `pnpm --filter @industriallink/api build` |
| `prisma/**` (schema thay đổi) | `pnpm --filter @industriallink/api db:generate && pnpm db:push` |
| Cả 2 | `pnpm --filter web build && pnpm --filter @industriallink/api build` |

### Bước 5 — Restart qua PM2 (không downtime nếu dùng `reload`, ở đây dùng `restart` cho chắc)

```bash
# Chỉ restart API nếu chỉ sửa api
pm2 restart inlink-api

# Chỉ restart web nếu chỉ sửa web
pm2 restart inlink-web

# Hoặc restart cả 2
pm2 restart all
```

### Bước 6 — Verify

```bash
# Cả 2 port đều LISTEN
ss -ltnp | grep -E ':(3000|3001)\b'

# Web public
curl -sI -m 10 https://inlink.vn/ | head -3

# API trực tiếp
curl -sI -m 10 http://127.0.0.1:3001/api/v1/cms/site-code | head -3

# PM2 status
pm2 status

# Tail log nếu lỗi
pm2 logs inlink-api --lines 50
pm2 logs inlink-web --lines 50

# Lỗi nginx gần nhất
tail -30 /www/wwwlogs/inlink.vn.error.log
```

---

## 6. Lệnh rút gọn (copy-paste nhanh)

```bash
# === Deploy nhanh sau khi push code ===
ssh root@<VPS_IP>
cd /www/wwwroot/inlink && \
  git pull origin main && \
  pnpm install --frozen-lockfile && \
  pnpm --filter web build && \
  pnpm --filter @industriallink/api build && \
  pm2 restart all && \
  sleep 3 && \
  curl -sI -m 10 https://inlink.vn/ | head -1 && \
  curl -sI -m 10 http://127.0.0.1:3001/api/v1/cms/site-code | head -1
```

Nếu 1 dòng trên trả về `HTTP/2 200` và dòng dưới `HTTP/1.1 200 OK` → deploy xong.

---

## 7. Khắc phục sự cố nhanh

| Triệu chứng | Nguyên nhân thường gặp | Cách xử |
| --- | --- | --- |
| `HTTP/2 504` ở mọi trang | Một upstream chết | `pm2 status` → restart process offline |
| `Connection refused` ở 3001 | API chưa chạy | `pm2 start inlink-api` hoặc build lại |
| `Connection refused` ở 3000 | Web chưa chạy | `pm2 start inlink-web` |
| `502 Bad Gateway` | Nginx không tới được upstream | Check `ss -ltnp` + `pm2 status` |
| Web chạy nhưng lỗi DB | Sai `DATABASE_URL` / Prisma chưa generate | `pnpm --filter @industriallink/api db:generate` |
| Sau reboot VPS mà site chết | PM2 chưa được `startup` | Chạy lại lệnh `pm2 startup` sinh ra lúc cài |
| Build API fail | TS error mới | `pnpm --filter @industriallink/api typecheck` xem chi tiết |

Reset toàn bộ nếu kẹt:

```bash
pm2 delete all
cd /www/wwwroot/inlink
git pull origin main
pnpm install
pnpm --filter web build
pnpm --filter @industriallink/api build
pm2 start ecosystem.config.cjs
pm2 save
```

---

## 8. Backup

- **Database**: chạy `pg_dump` theo cron hằng đêm, lưu ra `/www/backup/db-$(date +%F).sql.gz`.
- **MinIO**: nếu production thật, cân nhắc replicate sang bucket khác hoặc dùng snapshot hệ thống file.
- **`.env`**: lưu ra nơi an toàn (1Password / Bitwarden). Mất `.env` = phải rotate hết secret.

---

## 9. Những thứ TUYỆT ĐỐI không commit

- `.env`
- `node_modules/`
- `.next/`, `dist/`
- `coverage/`
- Bất kỳ API key, JWT secret, DB password nào
