import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), display-capture=(self), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      {
        source: "/((?!embed(?:/|$)).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};
export default nextConfig;
