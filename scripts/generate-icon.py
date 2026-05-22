#!/usr/bin/env python3
"""クラリネット練習帳アイコン生成スクリプト (B-1: ネイビー×ゴールド)"""

import os

try:
    import cairosvg
except ImportError:
    print("cairosvg が必要です: pip install cairosvg")
    print("日本語フォントが必要な場合: sudo apt-get install fonts-noto-cjk")
    raise

ASSETS_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images')

SVG_TEMPLATE = """<svg width="{size}" height="{size}" viewBox="0 0 1024 1024"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1E3A8A"/>
      <stop offset="100%" style="stop-color:#1E1B4B"/>
    </linearGradient>
  </defs>
  <!-- 背景 -->
  <rect width="1024" height="1024" rx="230" fill="url(#bg)"/>
  <!-- ノート本体 -->
  <rect x="166" y="141" width="692" height="742" rx="64" fill="#1E40AF"/>
  <!-- 背表紙（綴じ） -->
  <rect x="166" y="141" width="115" height="742" rx="38" fill="#2563EB"/>
  <!-- 綴じ穴 -->
  <circle cx="224" cy="269" r="26" fill="#1E3A8A"/>
  <circle cx="224" cy="384" r="26" fill="#1E3A8A"/>
  <circle cx="224" cy="499" r="26" fill="#1E3A8A"/>
  <circle cx="224" cy="614" r="26" fill="#1E3A8A"/>
  <circle cx="224" cy="729" r="26" fill="#1E3A8A"/>
  <!-- クラリネット (-40度 傾き) -->
  <g transform="translate(608,461) rotate(-40)">
    <rect x="-38" y="-294" width="77" height="589" rx="38" fill="#FBBF24"/>
    <circle cx="0" cy="-179" r="22" fill="#1E3A8A"/>
    <circle cx="0" cy="-90"  r="22" fill="#1E3A8A"/>
    <circle cx="0" cy="0"   r="22" fill="#1E3A8A"/>
    <circle cx="0" cy="90"  r="22" fill="#1E3A8A"/>
    <circle cx="0" cy="179" r="22" fill="#1E3A8A"/>
    <rect x="-45" y="-346" width="90" height="77" rx="26" fill="#FDE68A"/>
    <ellipse cx="0" cy="288" rx="58" ry="38" fill="#FBBF24"/>
  </g>
  <!-- 五線譜装飾 -->
  <line x1="320" y1="320" x2="755" y2="320" stroke="rgba(255,255,255,0.12)" stroke-width="6"/>
  <line x1="320" y1="371" x2="755" y2="371" stroke="rgba(255,255,255,0.12)" stroke-width="6"/>
  <line x1="320" y1="422" x2="755" y2="422" stroke="rgba(255,255,255,0.12)" stroke-width="6"/>
  <!-- 題字 -->
  <text x="512" y="819" text-anchor="middle" font-size="77" fill="#FDE68A"
        font-family="serif" letter-spacing="13" font-weight="bold">練習帳</text>
</svg>"""

OUTPUTS = [
    ('icon.png',                     1024),
    ('splash-icon.png',              1024),
    ('android-icon-foreground.png',  512),
    ('favicon.png',                  48),
]

def main():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    for filename, size in OUTPUTS:
        svg_content = SVG_TEMPLATE.format(size=size).encode('utf-8')
        out_path = os.path.join(ASSETS_DIR, filename)
        cairosvg.svg2png(bytestring=svg_content, write_to=out_path, output_width=size, output_height=size)
        print(f"生成完了: {out_path} ({size}x{size})")

    bg_svg = '<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="#1E3A8A"/></svg>'.encode()
    out_path = os.path.join(ASSETS_DIR, 'android-icon-background.png')
    cairosvg.svg2png(bytestring=bg_svg, write_to=out_path, output_width=512, output_height=512)
    print(f"生成完了: {out_path} (512x512)")

if __name__ == '__main__':
    main()
