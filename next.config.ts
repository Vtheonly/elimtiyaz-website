import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
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
