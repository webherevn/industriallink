-- Khởi tạo extension và schema cho IndustrialLink.
-- File này được PostgreSQL chạy tự động lần đầu khi container tạo volume.

-- Extension cần thiết.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid, mã hoá
CREATE EXTENSION IF NOT EXISTS "vector";     -- pgvector cho embedding / semantic search

-- Schema tách theo Business Domain (không dùng chung public).
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS candidate;
CREATE SCHEMA IF NOT EXISTS knowledge;
CREATE SCHEMA IF NOT EXISTS shared;
CREATE SCHEMA IF NOT EXISTS company;
CREATE SCHEMA IF NOT EXISTS recruitment;
-- Bảng notification (shared) được Prisma db push tạo; email provider thật deferred.
