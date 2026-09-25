import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
// The service worker is public/sw.js (web push only, written by hand). The Serwist wrapper that
// used to be here never ran under Turbopack (it only printed a warning on every build), and when it
// did run it would have overwritten that push worker.

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "clsx",
      "tailwind-merge",
      "@tanstack/react-query",
      "sonner",
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  // Pages removed in the site audit (docs/SITE_AUDIT_AND_CENTRAL_PLAN.md) send old links and
  // bookmarks to the page that now does the job, instead of a 404.
  async redirects() {
    const to = (source: string, destination: string) => ({ source, destination, permanent: false });
    return [
      to("/dashboard/breeding/:path*", "/dashboard/cattle"),
      to("/dashboard/breeding", "/dashboard/cattle"),
      to("/dashboard/cattle/breeding", "/dashboard/cattle"),
      to("/dashboard/cattle/analytics", "/dashboard/cattle"),
      to("/dashboard/cattle/growth", "/dashboard/cattle"),
      to("/dashboard/cattle/pens", "/dashboard/cattle"),
      to("/dashboard/cattle/feed", "/dashboard/inventory/feeding-chart"),
      to("/dashboard/cattle/health", "/dashboard/health"),
      to("/dashboard/cattle/vaccinations", "/dashboard/health/vaccinations"),
      to("/dashboard/health/:page(ai|audit|diseases|mortality|quarantine|timeline|reports|records)", "/dashboard/health"),
      to("/dashboard/inventory/:page(warehouse|reports|ai)", "/dashboard/inventory"),
      to("/dashboard/inventory/products", "/dashboard/inventory"),
      to("/dashboard/inventory/mix-feed", "/dashboard/inventory/mix"),
      to("/dashboard/commerce", "/dashboard/finance"),
      to("/dashboard/vendors", "/dashboard/inventory/purchase"),
      to("/dashboard/operations", "/dashboard/settings"),
      to("/dashboard/ai", "/dashboard"),
      to("/dashboard/help", "/dashboard"),
      to("/workflows", "/dashboard"),
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '54321',
        pathname: '/storage/v1/object/public/**',
      }
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI output during build
  silent: !process.env.CI,
  // Upload source maps only when SENTRY_AUTH_TOKEN is set
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Disable source map upload if token is missing (local dev)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
});
