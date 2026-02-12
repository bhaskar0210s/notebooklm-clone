import path from "path";
import { fileURLToPath } from "url";

// Load root .env for local development convenience
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  const { config } = await import("dotenv");
  config({ path: path.resolve(__dirname, "../.env") });
} catch {
  // dotenv not installed—ensure required environment variables are available
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile packages that use ESM exports
  transpilePackages: [],
  // Turbopack configuration
  turbopack: {},
  // Enable standalone output for Docker
  output: "standalone",
};

export default nextConfig;
