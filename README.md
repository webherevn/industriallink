# IndustrialLink

> Nền tảng kết nối nguồn nhân lực công nghiệp tích hợp AI.
> _Kết nối đúng người – Thúc đẩy công nghiệp._

Đây là **walking skeleton** (bộ khung chạy được thật) cho IndustrialLink, dựng theo kiến trúc chuẩn:
**Modular Monolith + Domain-Driven Design + Clean Architecture + Event-Driven + AI Gateway + API-first + Multi-tenant**.

Skeleton chứng minh toàn bộ kiến trúc qua đúng một luồng nghiệp vụ đầu-cuối:

```
Đăng ký / Đăng nhập (JWT + RBAC)
  -> Upload CV (PDF)  -> lưu MinIO + metadata
  -> phát sự kiện ResumeUploaded -> hàng đợi BullMQ
  -> Worker gọi AI Gateway phân tích CV
  -> tạo Candidate Profile + Skills + AI Summary + Embedding
  -> phát ResumeParsed / CandidateUpdated -> cập nhật Search Index + Timeline
  -> Web hiển thị màn hình "AI Resume Analysis" + Dashboard
```

## Kiến trúc & công nghệ

| Thành phần        | Công nghệ                                             |
| ----------------- | ----------------------------------------------------- |
| Monorepo          | pnpm workspaces + Turborepo                           |
| Backend           | NestJS (TypeScript), Modular Monolith, Clean Arch      |
| Database          | PostgreSQL 16 + pgvector (multi-schema theo domain)    |
| ORM               | Prisma                                                 |
| Hàng đợi / Event  | BullMQ (Redis) + Event Bus in-process                  |
| Cache             | Redis                                                  |
| Object Storage    | MinIO (S3-compatible)                                  |
| AI                | AI Gateway provider-agnostic (mock / OpenAI / Anthropic / Gemini) |
| Frontend          | Next.js (App Router) + Tailwind + TanStack Query + Zod |

## Cấu trúc thư mục

```
industriallink/
  apps/
    api/          # Backend NestJS (Modular Monolith)
    web/          # Frontend Next.js (Candidate Workspace tối giản)
  packages/
    contracts/    # Hợp đồng dùng chung FE/BE (enum, DTO, tên sự kiện)
    config/       # tsconfig / prettier dùng chung
  infra/
    docker-compose.yml  # postgres + redis + minio + mailpit + jaeger + prometheus + opensearch + rabbitmq
    prometheus.yml      # scrape OTEL metrics :9464
    init/               # SQL khởi tạo extension + schema
```

## Yêu cầu

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
- Docker + Docker Compose (Postgres / Redis / MinIO / Jaeger / Prometheus / OpenSearch / RabbitMQ)

## Khởi động nhanh

```bash
# 1. Cài dependencies
pnpm install

# 2. Tạo file .env từ mẫu
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env

# 3. Bật hạ tầng local
pnpm infra:up

# 4. Khởi tạo schema DB + seed taxonomy kỹ năng
pnpm db:push
pnpm db:seed

# 5. Chạy backend + frontend
pnpm dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Swagger (tài liệu API): http://localhost:3001/docs
- MinIO Console: http://localhost:9001 (user/pass: `industriallink`)
- Mailpit: http://localhost:8025
- Jaeger (traces): http://localhost:16686
- Prometheus: http://localhost:9090
- OTEL metrics: http://localhost:9464/metrics
- OpenSearch: http://localhost:9200
- RabbitMQ Management: http://localhost:15672 (guest/guest)

### Demo luồng end-to-end

1. Mở http://localhost:3000, bấm **Đăng ký** với vai trò **Ứng viên**.
2. Nhập OTP (ở chế độ dev, mã hiển thị ngay trên màn hình và trong log API).
3. Đăng nhập -> vào **Dashboard** -> bấm **Tải CV lên**.
4. Dùng CV mẫu có sẵn: [`samples/cv-automation-engineer.txt`](samples/cv-automation-engineer.txt).
5. Xem màn hình **AI Resume Analysis** chạy tiến trình theo thời gian thực (poll trạng thái job).
6. Khi xong, Dashboard hiển thị tóm tắt AI, điểm AI, kỹ năng và lộ trình nghề nghiệp.
7. (Tùy chọn) Đăng ký một tài khoản **Nhà tuyển dụng** để thử màn hình **Tìm ứng viên bằng AI**.

### AI ở chế độ mock và bật LLM thật

Mặc định `AI_PROVIDER=mock` nên hệ thống chạy được ngay mà **không cần API key** (parse CV / embedding / matching dùng từ khoá công nghiệp).

Muốn dùng LLM thật, sửa `.env` (xem `.env.example`):

```env
# Chọn một: openai | anthropic | gemini
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Hoặc Anthropic
# AI_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-3-5-sonnet-latest

# Hoặc Gemini (khuyến nghị Flash mới nhất — free tier AI Studio)
# AI_PROVIDER=gemini
# GEMINI_API_KEY=...
# GEMINI_MODEL=gemini-3.6-flash
# GEMINI_EMBEDDING_MODEL=text-embedding-004
# Dự phòng: GEMINI_MODEL=gemini-2.5-flash
```

Nếu thiếu API key tương ứng, AI Gateway **tự fallback về mock** và ghi log cảnh báo. Không hardcode key trong code.

**AI Search (NTD):** đăng nhập nhà tuyển dụng → menu **Tìm ứng viên bằng AI** (`/search`) → nhập câu mô tả nhu cầu (ví dụ *Kỹ sư PLC Siemens 3 năm kinh nghiệm nhà máy Đồng Nai*). Kết quả kèm điểm phù hợp, lý do và kỹ năng khớp.

**Parse CV:** hỗ trợ TXT, PDF, DOCX (trích text thật). DOC Word cũ chưa hỗ trợ — hãy chuyển PDF/DOCX/TXT.

### Kiểm thử (API)

```bash
pnpm --filter @industriallink/api typecheck
pnpm --filter @industriallink/api lint
pnpm --filter @industriallink/api test
```

### Thông báo in-app (MVP)

- Chuông trên AppShell + trang `/notifications`; poll ~30s.
- Tự tạo khi ứng viên nộp đơn (gửi NTD) hoặc NTD đổi trạng thái (gửi ứng viên).
- **Email mời / huỷ PV, offer, onboarding**: Email Gateway (`mock` | `smtp` | `resend`). Local: Mailpit UI `http://localhost:8025` (SMTP `:1025`).
- **Email OTP đăng ký**: event `OtpIssued` → gửi mã qua Email Gateway; `POST /auth/resend-otp` (rate limit 3/phút).
- **Bulk email**: NTD gửi hàng loạt từ pipeline tin (`POST /jobs/:id/broadcast-email`).

### Observability (MVP)

- `GET /api/v1/health` — liveness (DB + Redis status)
- `GET /api/v1/health/ready` — readiness (503 nếu DB **hoặc** Redis down)
- Structured log (Pino) + Correlation-Id trên mọi request (gắn vào OTEL span `correlation.id`)
- **OpenTelemetry**: traces OTLP → Jaeger UI `http://localhost:16686`; metrics Prometheus exporter `:9464/metrics` (Prometheus UI `http://localhost:9090`)
- Bật/tắt: `OTEL_ENABLED` (mặc định `true`). Endpoint: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_METRICS_PORT`
- **OpenSearch**: full-text projection cho AI Search (`OPENSEARCH_NODE`, mặc định `http://localhost:9200`). Lỗi/tắt → fallback pgvector → ILIKE Postgres.
- **Event Bus / RabbitMQ**: `EVENT_BUS_PROVIDER=rabbitmq|memory`. Local: Management UI `http://localhost:15672` (guest/guest). Lỗi kết nối → fallback in-process memory.
- **RAG Copilot**: `POST /api/v1/ai/copilot/chat` — lấy ngữ cảnh pipeline/tin/ứng viên rồi trả lời qua AI Gateway (mock local không cần key). UI: dashboard `/recruiter`.
- **MFA (OTP email hoặc TOTP)**: bật tại `/account`. OTP email: `PATCH /auth/me/mfa`. TOTP (Google Authenticator...): `POST /auth/me/totp/setup` (sinh QR) → `POST /auth/me/totp/verify` (xác nhận, bật) → `POST /auth/me/totp/disable` (tắt). Chỉ 1 phương thức bật cùng lúc. Khi đăng nhập, nếu MFA bật → challenge (`mfaRequired`, `mfaMethod`) rồi `POST /auth/verify-login-otp` (dùng chung cho cả 2 phương thức). Dev: `devOtp` + Mailpit (chỉ áp dụng email OTP).

## Nguyên tắc kỹ thuật (Hiến pháp)

1. Không truy cập Database ngoài Repository.
2. Không gọi AI trực tiếp từ Controller — luôn qua AI Gateway.
3. Không query search từ Business Logic — qua SearchService.
4. Không gửi thông báo trực tiếp từ Module nghiệp vụ — qua Event.
5. Không hardcode Taxonomy — dùng Knowledge Domain.
6. Mọi thao tác quan trọng đều phát Event (versioned).
7. Mọi request có Correlation-Id + structured logging.
8. Mọi thay đổi dữ liệu có Audit Log; xoá mềm (soft delete).

## Lộ trình tiếp theo

Core-first: … → OpenSearch → RabbitMQ → **RAG Copilot** (đã có, mock local).

Core-first + MFA (OTP email + TOTP/Google Authenticator) đã có. Unit test cho các domain nghiệp vụ lớn (company, job, application, interview, offer, onboarding, identity/MFA + TOTP) đã có (`apps/api`: 14 test suite / 112 test). Giai đoạn sau: Kafka (nếu cần scale), tách microservice.
