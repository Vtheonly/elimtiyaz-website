import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // T-049 / ARCH-005: type errors MUST fail the build. The previous
  // `ignoreBuildErrors: true` shipped type errors to production silently.
  // The 86 surfaced errors were fixed (2026-08-29); do not re-enable this.
  typescript: {
    ignoreBuildErrors: false,
  },
  // T-049 / ARCH-005: React strict mode ON (the default) — it surfaces
  // double-render / missing-cleanup bugs in development instead of hiding
  // them.
  reactStrictMode: true,
  // Allow the IM preview proxy to load Next.js dev assets without warnings.
  allowedDevOrigins: ["*.space-z.ai"],
  images: {
    remotePatterns: [
      // Google OAuth profile pictures.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Generic Google avatars.
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
