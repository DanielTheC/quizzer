import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**",
      },
    ],
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
