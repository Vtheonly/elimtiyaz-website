#!/usr/bin/env python3
"""
Generate PWA PNG icons (192×192, 512×512, plus maskable variants) from the
source SVG. Also generates a few simple "screenshot" placeholders so the
PWA install prompt fires reliably on Android 12+.

Output goes into the public/ directory.
"""

from pathlib import Path
import cairosvg

PUBLIC = Path("/home/z/my-project/elimtiyaz-website/public")
SVG = PUBLIC / "icon.svg"

# Standard icons (any + maskable).
for size in (192, 512):
    out = PUBLIC / f"icon-{size}.png"
    cairosvg.svg2png(url=str(SVG), write_to=str(out), output_width=size, output_height=size)
    print(f"wrote {out.name} ({size}x{size})")

# Maskable icons need a safe zone — the central 80% of the canvas. We render
# a slightly larger background to fill the corners, then overlay the icon
# scaled down. Easiest approach: render a separate SVG with padding.
maskable_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1E1F20"/>
      <stop offset="1" stop-color="#242526"/>
    </linearGradient>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#349BD4"/>
      <stop offset="1" stop-color="#2B7FB0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(128, 128) scale(2.667)">
    <path d="M48 22 L74 34 L48 46 L22 34 Z" fill="url(#g)"/>
    <path d="M30 40 L30 56 C30 60 38 64 48 64 C58 64 66 60 66 56 L66 40 L48 49 Z" fill="#C8A98C"/>
    <rect x="71" y="34" width="3" height="18" rx="1.5" fill="#6EC1E4"/>
  </g>
</svg>
"""

for size in (192, 512):
    out = PUBLIC / f"icon-maskable-{size}.png"
    cairosvg.svg2png(bytestring=maskable_svg.encode("utf-8"), write_to=str(out), output_width=size, output_height=size)
    print(f"wrote {out.name} ({size}x{size})")

# Apple touch icon (180×180, no transparency, opaque background).
apple_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
  <rect width="180" height="180" fill="#242526"/>
  <g transform="translate(42, 42) scale(1)">
    <path d="M48 22 L74 34 L48 46 L22 34 Z" fill="#349BD4"/>
    <path d="M30 40 L30 56 C30 60 38 64 48 64 C58 64 66 60 66 56 L66 40 L48 49 Z" fill="#C8A98C"/>
    <rect x="71" y="34" width="3" height="18" rx="1.5" fill="#6EC1E4"/>
  </g>
</svg>
"""
out = PUBLIC / "apple-touch-icon.png"
cairosvg.svg2png(bytestring=apple_svg.encode("utf-8"), write_to=str(out), output_width=180, output_height=180)
print(f"wrote {out.name} (180x180)")

# Favicons (32 + 16) for browser tabs.
for size in (16, 32):
    out = PUBLIC / f"favicon-{size}.png"
    cairosvg.svg2png(url=str(SVG), write_to=str(out), output_width=size, output_height=size)
    print(f"wrote {out.name} ({size}x{size})")

# Screenshots — generate two minimal placeholders so the manifest's
# `screenshots` array is non-empty (required for richer install UI on
# Android 12+). We render a 1080×1920 portrait and a 1920×1080 landscape
# both with the brand gradient + a faux app header.
def screenshot(width: int, height: int, name: str, orientation: str):
    if orientation == "portrait":
        # Mobile portrait — header bar + 4 KPI cards in a 2x2 grid.
        body = f"""
          <rect width="{width}" height="{height}" fill="#242526"/>
          <rect width="{width}" height="180" fill="#1E1F20"/>
          <text x="{width // 2}" y="110" fill="#FFFFFF" font-family="sans-serif" font-size="48" text-anchor="middle" font-weight="bold">El-Imtiyaz</text>
          <g transform="translate(80, 280)">
            <rect width="{(width - 240) // 2}" height="220" rx="20" fill="#2A2B2D" stroke="#3A3B3D" stroke-width="2"/>
            <rect x="{(width - 160) // 2}" width="{(width - 240) // 2}" height="220" rx="20" fill="#2A2B2D" stroke="#3A3B3D" stroke-width="2"/>
            <rect y="260" width="{(width - 240) // 2}" height="220" rx="20" fill="#2A2B2D" stroke="#3A3B3D" stroke-width="2"/>
            <rect x="{(width - 160) // 2}" y="260" width="{(width - 240) // 2}" height="220" rx="20" fill="#2A2B2D" stroke="#3A3B3D" stroke-width="2"/>
          </g>
        """
    else:
        # Desktop landscape — left rail + content area.
        body = f"""
          <rect width="{width}" height="{height}" fill="#242526"/>
          <rect width="320" height="{height}" fill="#1E1F20"/>
          <rect x="60" y="60" width="200" height="24" rx="6" fill="#3A3B3D"/>
          <rect x="60" y="140" width="200" height="60" rx="10" fill="#349BD4" fill-opacity="0.2"/>
          <g transform="translate(400, 80)">
            <rect width="{width - 480}" height="60" rx="10" fill="#2A2B2D"/>
            <rect y="100" width="{(width - 520) // 3}" height="280" rx="20" fill="#2A2B2D" stroke="#3A3B3D" stroke-width="2"/>
            <rect x="{(width - 480) // 3 + 20}" y="100" width="{(width - 520) // 3}" height="280" rx="20" fill="#2A2B2D" stroke="#3A3B3D" stroke-width="2"/>
            <rect x="{((width - 480) // 3) * 2 + 40}" y="100" width="{(width - 520) // 3}" height="280" rx="20" fill="#2A2B2D" stroke="#3A3B3D" stroke-width="2"/>
          </g>
        """
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
      {body}
    </svg>"""
    out = PUBLIC / name
    cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=str(out), output_width=width, output_height=height)
    print(f"wrote {out.name} ({width}x{height})")

screenshot(1080, 1920, "screenshot-mobile.png", "portrait")
screenshot(1920, 1080, "screenshot-desktop.png", "landscape")

print("\nAll PWA icons + screenshots generated.")
