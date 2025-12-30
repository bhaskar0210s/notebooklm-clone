/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile packages that use ESM exports
  transpilePackages: ['@langchain/community'],
  // Turbopack configuration
  turbopack: {},
};

export default nextConfig;

