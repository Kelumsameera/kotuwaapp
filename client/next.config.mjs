import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.js");

const API_URL = process.env.API_URL || "http://localhost:5050";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Off for now: the language comes from a cookie read in the root layout,
  // which Cache Components does not allow outside a <Suspense> boundary.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // The browser only talks to this site. /api/* is passed on to the Express server,
  // so auth cookies stay first-party and sameSite=strict works.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },

  // Basic browser security headers for every page.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default withNextIntl(nextConfig);
