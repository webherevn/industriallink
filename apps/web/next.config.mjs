/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next đọc thẳng mã nguồn TS của gói contracts (điều kiện "import" -> src/index.ts)
  // và tự biên dịch, tránh lỗi Fast Refresh với bản build CommonJS.
  transpilePackages: ['@industriallink/contracts'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
