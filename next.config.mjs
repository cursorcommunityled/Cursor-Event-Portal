import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["pdfjs-dist"],
  async redirects() {
    return [
      // Old attendee URL redirects
      { source: "/calgary-jan-2026", destination: "/calgary-feb-2026", permanent: true },
      { source: "/calgary-jan-2026/:path*", destination: "/calgary-feb-2026/:path*", permanent: true },
      { source: "/calgary-jan-26", destination: "/calgary-feb-2026", permanent: true },
      { source: "/calgary-jan-26/:path*", destination: "/calgary-feb-2026/:path*", permanent: true },
      // Old admin URL format /admin/:slug/:code/:path+ → /admin/:code/:path+ (only for calgary-* slugs to avoid redirect loop)
      { source: "/admin/:slug(calgary-[^/]+)/:code/:path+", destination: "/admin/:code/:path+", permanent: true },
      // Old admin URL format /admin/:slug/:code → /admin/:code (exact, no trailing path)
      { source: "/admin/:slug(calgary-[^/]+)/:code", destination: "/admin/:code", permanent: true },
      // Short admin sub-page redirects → /admin/feb2026/:page
      { source: "/admin/agenda", destination: "/admin/feb2026/agenda", permanent: false },
      { source: "/admin/analytics", destination: "/admin/feb2026/analytics", permanent: false },
      { source: "/admin/announcements", destination: "/admin/feb2026/announcements", permanent: false },
      { source: "/admin/checkin", destination: "/admin/feb2026/checkin", permanent: false },
      { source: "/admin/competitions", destination: "/admin/feb2026/competitions", permanent: false },
      { source: "/admin/data", destination: "/admin/feb2026/data", permanent: false },
      { source: "/admin/export", destination: "/admin/feb2026/export", permanent: false },
      { source: "/admin/groups", destination: "/admin/feb2026/groups", permanent: false },
      { source: "/admin/help", destination: "/admin/feb2026/help", permanent: false },
      { source: "/admin/polls", destination: "/admin/feb2026/polls", permanent: false },
      { source: "/admin/qa", destination: "/admin/feb2026/qa", permanent: false },
      { source: "/admin/registrations", destination: "/admin/feb2026/registrations", permanent: false },
      { source: "/admin/slides", destination: "/admin/feb2026/slides", permanent: false },
      { source: "/admin/social", destination: "/admin/feb2026/social", permanent: false },
      { source: "/admin/surveys", destination: "/admin/feb2026/surveys", permanent: false },
      { source: "/admin/timer", destination: "/admin/feb2026/timer", permanent: false },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      allowedOrigins: [
          "localhost:3000",
          "http://localhost:3000",
          "cursor-popup-portal.onrender.com",
          "https://cursor-popup-portal.onrender.com",
          "cursorcalgary.com",
          "https://cursorcalgary.com",
          "www.cursorcalgary.com",
          "https://www.cursorcalgary.com",
        ],
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "./src"),
    };
    if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true") {
      config.resolve.alias["@/lib/supabase/queries"] = path.resolve(
        __dirname,
        "./src/lib/mock/queries.ts"
      );
    }
    return config;
  },
};

export default nextConfig;
