import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { AppProviders } from "@/app/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "El-Imtiyaz Portal — Espace Parent & Élève",
  description:
    "Portail client El-Imtiyaz : consultez les notes, les emplois du temps, les absences, les paiements et les communications scolaires.",
  keywords: [
    "El-Imtiyaz",
    "portail parent",
    "espace élève",
    "notes",
    "paiements",
    "école",
  ],
  authors: [{ name: "El-Imtiyaz Platform" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "El-Imtiyaz",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/icon-192.png"],
  },
  openGraph: {
    title: "El-Imtiyaz Portal",
    description: "Espace Parent & Élève",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#242526",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${notoSansArabic.variable} font-sans antialiased bg-background text-foreground`}
      >
        <AppProviders>{children}</AppProviders>
        <SonnerToaster position="top-center" richColors />
      </body>
    </html>
  );
}
