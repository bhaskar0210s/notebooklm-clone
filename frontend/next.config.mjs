/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile packages that use ESM exports
  transpilePackages: ["@langchain/community"],
  // Turbopack configuration
  turbopack: {},
  // Enable standalone output for Docker
  output: "standalone",
};

export default nextConfig;
