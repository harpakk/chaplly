import type { NextConfig } from "next";
import { config } from "dotenv";

config({ path: ".envsecure" });

const nextConfig: NextConfig = {
  // Keep development HMR modules isolated from production-build artifacts.
  // Running `next build` while `next dev` is open otherwise mixes manifests
  // and can produce "webpack_modules[moduleId] is not a function" at runtime.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  poweredByHeader: false,
  output: "standalone",
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https",
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: "/storage/v1/object/**",
          },
        ]
      : [],
  },
  async headers() {
    const supabaseOrigin = (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin;
      } catch {
        return "";
      }
    })();
    const production = process.env.DEPLOYMENT_ENV === "production";
    const connectSources = ["'self'", supabaseOrigin, "wss:"]
      .filter(Boolean)
      .join(" ");
    const policy = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      `connect-src ${connectSources}`,
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(production ? ["upgrade-insecure-requests"] : []),
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: policy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          ...(production
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      bodySizeLimit: "120mb",
    },
  },
};

export default nextConfig;
