import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Đọc NEXT_PUBLIC_* từ .env ở root monorepo (Next mặc định chỉ đọc apps/web). */
function loadRootPublicEnv() {
  const rootEnvPath = resolve(__dirname, '../../.env');
  if (!existsSync(rootEnvPath)) return;
  const text = readFileSync(rootEnvPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key.startsWith('NEXT_PUBLIC_')) continue;
    if (process.env[key] !== undefined) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Production build trên VPS: bỏ qua localhost (dùng same-origin /api proxy).
    // Local `next dev`: vẫn load NEXT_PUBLIC_API_URL=http://localhost:3001.
    if (
      process.env.NODE_ENV === 'production' &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(val)
    ) {
      continue;
    }
    process.env[key] = val;
  }
}

loadRootPublicEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next đọc thẳng mã nguồn TS của gói contracts (điều kiện "import" -> src/index.ts)
  // và tự biên dịch, tránh lỗi Fast Refresh với bản build CommonJS.
  transpilePackages: ['@industriallink/contracts', '@industriallink/vn-admin'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
