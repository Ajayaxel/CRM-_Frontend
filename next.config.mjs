const BUILD_ID = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12)
  || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12)
  || String(Date.now());

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The portal's service worker keys its caches on this. Without a per-build id
  // it pinned a constant version, never purged, and served last week's chunks
  // cache-first — the app looked unchanged after a deploy.
  generateBuildId: () => BUILD_ID,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },

  // Lean, self-contained production build for Docker/CD.
  output: 'standalone',

  // ESLint isn't configured in this repo yet — don't let it block CI builds.
  // (Type errors still fail the build; see tsconfig.)
  eslint: { ignoreDuringBuilds: true },

  // Disable webpack filesystem cache — prevents ENOENT rename failures
  // on paths with spaces (e.g. iCloud Drive "Mobile Documents").
  webpack(config) {
    config.cache = false;
    return config;
  },

  /**
   * The API sent a full helmet header set; this origin sent none — and this is
   * the origin a browser actually loads. So the app could be framed, and a
   * response could be MIME-sniffed into something executable, while the API
   * next door looked perfectly hardened.
   *
   * No CSP here on purpose. Next's App Router inlines hydration scripts, so a
   * script-src without 'unsafe-inline' breaks the app and a CSP WITH it buys
   * little — that wants a nonce-based setup and its own testing pass, not a
   * line bolted on beside four safe ones.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // HTTPS only, for a year, including subdomains. Matches the API's.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // No framing — the CRM holds financial data behind a session cookie,
          // which is exactly what clickjacking monetises.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Never let a browser guess a content type it was not given.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Do not leak tenant ids or record ids in the Referer to third parties.
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        // Sales onboarding handbook. A static file in public/, so it is served
        // whether or not anyone is signed in — the page carries its own lock.
        // Next.js resolves public/training/index.html at /training/index.html
        // and not at /training, which is the URL people will actually be given.
        source: '/training',
        destination: '/training/index.html',
      },
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4400/api'}/:path*`,
      },
      {
        // Omnichannel + AI microservice
        source: '/omni/:path*',
        destination: `${process.env.NEXT_PUBLIC_OMNI_URL || 'http://localhost:4500/omni'}/:path*`,
      },
      {
        // HLS lecture recordings (segments served by the API's static mount)
        source: '/recordings/:path*',
        destination: `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4400/api').replace(/\/api\/?$/, '')}/recordings/:path*`,
      },
      {
        // First-party uploaded media: video HLS, captions, PDFs, images (API static mount)
        source: '/files/:path*',
        destination: `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4400/api').replace(/\/api\/?$/, '')}/files/:path*`,
      },
    ];
  },
};

export default nextConfig;
