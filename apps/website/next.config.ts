import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const cspGlobal =
  "default-src 'self'; script-src 'self' https://cdn.sanity.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://cdn.sanity.io https://*.supabase.co; connect-src 'self' https://*.supabase.co https://api.sanity.io wss://*.supabase.co; frame-ancestors 'none';";

const cspStudio =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.sanity.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://cdn.sanity.io https://*.supabase.co; connect-src 'self' https://*.supabase.co https://api.sanity.io wss://*.supabase.co; frame-ancestors 'none';";

const baseSecurityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/((?!studio).*)",
        headers: [
          ...baseSecurityHeaders,
          { key: "Content-Security-Policy", value: cspGlobal },
        ],
      },
      {
        source: "/studio/:path*",
        headers: [
          ...baseSecurityHeaders,
          { key: "Content-Security-Policy", value: cspStudio },
        ],
      },
    ];
  },
};

const org = process.env.SENTRY_ORG?.trim();
const project = process.env.SENTRY_PROJECT?.trim();

export default org && project
  ? withSentryConfig(nextConfig, {
      org,
      project,
      silent: !process.env.CI,
      ...(process.env.SENTRY_AUTH_TOKEN?.trim()
        ? { authToken: process.env.SENTRY_AUTH_TOKEN }
        : {}),
    })
  : nextConfig;
