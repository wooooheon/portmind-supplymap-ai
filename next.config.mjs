/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: false
  },
  outputFileTracingIncludes: {
    "/*": ["./prisma/dev.db"]
  }
};

export default nextConfig;
