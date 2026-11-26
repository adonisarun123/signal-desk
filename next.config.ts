import type { NextConfig } from "next";

const security = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  // The dashboard is a static shell (public/) over the /api routes.
  async rewrites() {
    return [{ source: "/", destination: "/index.html" }];
  },
  async headers() {
    return [
      { source: "/", headers: [...security, { key: "Cache-Control", value: "private, no-cache" }] },
      { source: "/:path*", headers: security },
    ];
  },
};

export default nextConfig;
