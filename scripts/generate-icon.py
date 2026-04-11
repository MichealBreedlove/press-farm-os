#!/usr/bin/env python3
"""Generate Press Farm OS icon - olive branch on cream circle, matching Gemini design."""

import cairosvg
from PIL import Image
import io

SVG_ICON = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Cream circle background -->
  <circle cx="256" cy="256" r="250" fill="#F8F5EB"/>

  <!-- Olive branch - angled from bottom-left to upper-right -->
  <g transform="translate(256, 248) rotate(-30) translate(-256, -256)">

    <!-- Main stem -->
    <path d="M 145 385 C 185 340 235 280 270 235 C 300 195 330 160 355 125"
          stroke="#00774A" stroke-width="9" fill="none" stroke-linecap="round"/>

    <!-- === LEAVES (wide, organic elliptical shapes) === -->

    <!-- Bottom-left leaf -->
    <ellipse cx="130" cy="345" rx="42" ry="16" fill="#00774A"
             transform="rotate(-55, 130, 345)"/>

    <!-- Bottom-right leaf -->
    <ellipse cx="195" cy="365" rx="38" ry="14" fill="#00774A"
             transform="rotate(30, 195, 365)"/>

    <!-- Left leaf 2 -->
    <ellipse cx="165" cy="295" rx="45" ry="17" fill="#00774A"
             transform="rotate(-60, 165, 295)"/>

    <!-- Right leaf 2 -->
    <ellipse cx="235" cy="315" rx="40" ry="15" fill="#00774A"
             transform="rotate(25, 235, 315)"/>

    <!-- Left leaf 3 -->
    <ellipse cx="215" cy="240" rx="45" ry="17" fill="#00774A"
             transform="rotate(-55, 215, 240)"/>

    <!-- Right leaf 3 -->
    <ellipse cx="300" cy="255" rx="42" ry="15" fill="#00774A"
             transform="rotate(30, 300, 255)"/>

    <!-- Left leaf 4 -->
    <ellipse cx="270" cy="185" rx="42" ry="16" fill="#00774A"
             transform="rotate(-55, 270, 185)"/>

    <!-- Right leaf 4 -->
    <ellipse cx="345" cy="195" rx="38" ry="14" fill="#00774A"
             transform="rotate(25, 345, 195)"/>

    <!-- Top left leaf -->
    <ellipse cx="315" cy="140" rx="38" ry="14" fill="#00774A"
             transform="rotate(-50, 315, 140)"/>

    <!-- Top right small leaf -->
    <ellipse cx="370" cy="145" rx="30" ry="11" fill="#00774A"
             transform="rotate(20, 370, 145)"/>

    <!-- === OLIVES === -->

    <!-- Olive 1 (lower) -->
    <ellipse cx="205" cy="295" rx="17" ry="21" fill="#005C3A"
             transform="rotate(-30, 205, 295)"/>
    <ellipse cx="200" cy="289" rx="5" ry="6" fill="#E0E8D8"
             transform="rotate(-30, 200, 289)"/>

    <!-- Olive 2 (upper) -->
    <ellipse cx="272" cy="222" rx="18" ry="23" fill="#005C3A"
             transform="rotate(-30, 272, 222)"/>
    <ellipse cx="267" cy="215" rx="5.5" ry="6.5" fill="#E0E8D8"
             transform="rotate(-30, 267, 215)"/>
  </g>
</svg>'''

def generate_icon(size, output_path):
    """Convert SVG to PNG at the given size."""
    png_data = cairosvg.svg2png(bytestring=SVG_ICON.encode(), output_width=size, output_height=size)
    img = Image.open(io.BytesIO(png_data))
    img.save(output_path, "PNG")
    print(f"Saved {output_path} ({size}x{size})")
    return img

# Generate both PWA icon sizes
generate_icon(512, "/home/user/press-farm-os/public/icon-512.png")
generate_icon(192, "/home/user/press-farm-os/public/icon-192.png")

# Generate favicon
img32 = generate_icon(32, "/tmp/favicon-32.png")
img16 = generate_icon(16, "/tmp/favicon-16.png")
img32.save("/home/user/press-farm-os/public/favicon.ico", format="ICO", sizes=[(32, 32)])
print("Saved favicon.ico")
