import path from "path";
import { fileURLToPath } from "url";

// Load root .env so frontend can use SUPABASE_* (e.g. for /api/documents)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  const { config } = await import("dotenv");
  config({ path: path.resolve(__dirname, "../.env") });
} catch {
  // dotenv not installed—ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
  // are in frontend/.env.local or your environment
}

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
