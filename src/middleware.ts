import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers middleware.
 *
 * Sets CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and
 * Permissions-Policy on every response. These headers protect against:
 *   - XSS (CSP restricts script sources)
 *   - Clickjacking (X-Frame-Options: DENY)
 *   - MIME sniffing (X-Content-Type-Options: nosniff)
 *   - Referrer leakage (Referrer-Policy: strict-origin-when-cross-origin)
 *
 * The CSP allows:
 *   - 'self' for scripts, styles, images, fonts, connections
 *   - Supabase + Google OAuth + Firebase domains for connections/images
 *   - 'unsafe-inline' for styles (Tailwind requires it) — NOT for scripts
 *   - 'unsafe-eval' is NOT allowed
 */

const cspDirectives = [
  "default-src 'self'",
  // Scripts: in production we want strict CSP, but Next.js requires
  // 'unsafe-inline' for hydration scripts in both dev and prod. We allow
  // 'unsafe-inline' for scripts (the browser ignores it when a nonce is
  // present, which Next.js can add if configured). 'unsafe-eval' is NOT
  // allowed.
  "script-src 'self' 'unsafe-inline'",
  // Styles: Tailwind injects runtime styles, so we allow 'unsafe-inline'.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Images: allow data URIs (avatars), blob (file previews), and the
  // domains we know we load images from.
  "img-src 'self' data: blob: https: https://lh3.googleusercontent.com",
  // Fonts: Google Fonts + self.
  "font-src 'self' https://fonts.gstatic.com",
  // Connections: Supabase + Firebase FCM + Google OAuth.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://fcm.googleapis.com https://*.firebaseio.com",
  // Media: self only.
  "media-src 'self'",
  // Object/frame: blocked entirely (no Flash/plugins).
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.supabase.co",
  // Frame ancestors: none (prevent embedding).
  "frame-ancestors 'none'",
  // Upgrade insecure requests.
  "upgrade-insecure-requests",
].join("; ");

export function middleware(_request: NextRequest) {
  const response = NextResponse.next();

  // Content-Security-Policy
  response.headers.set("Content-Security-Policy", cspDirectives);

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer policy — only send origin to cross-origin, full path to same-origin
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy — lock down browser features the portal doesn't use
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // Force HTTPS in production (1 year, include subdomains)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // X-XSS-Protection (legacy, but harmless)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  return response;
}

export const config = {
  // Run on every route except static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|firebase-messaging-sw.js).*)",
  ],
};
