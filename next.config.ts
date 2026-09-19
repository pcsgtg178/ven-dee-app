import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["spotless-twisty-spilt.ngrok-free.dev"],
  async headers() {
    return [
      {
        // HTML pages: prevent stale caching so new deployments are served immediately
        source: "/((?!_next/static|_next/image|favicon.ico|icon-).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      ];
  },
};

export default nextConfig;
