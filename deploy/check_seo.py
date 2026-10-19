"""一次性自检：SEO head、JSON-LD、静态资源是否齐备。"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text(encoding="utf-8")

checks = {
    "canonical": 'rel="canonical"',
    "h1": '<h1 class="sr-only">',
    "og:image": 'property="og:image"',
    "og:url": 'property="og:url"',
    "twitter:card 大图": "summary_large_image",
    "apple-touch-icon": "apple-touch-icon",
    "manifest": 'rel="manifest"',
    "theme-color": 'name="theme-color"',
    "ld+json": "application/ld+json",
}
for name, needle in checks.items():
    print(f"{'OK  ' if needle in html else 'MISS'} {name}")

m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
data = json.loads(m.group(1))
print(f"JSON-LD 可解析: @type={data['@type']}, featureList={len(data['featureList'])} 条")
print(f"h1 数量: {html.count('<h1')}")

for rel in ["img/og-cover.png", "img/apple-touch-icon.png", "img/icon-192.png",
            "img/icon-512.png", "site.webmanifest", "wrangler.jsonc"]:
    p = ROOT / rel
    print(f"{'OK  ' if p.exists() else 'MISS'} {rel}")

manifest = json.loads((ROOT / "site.webmanifest").read_text(encoding="utf-8"))
print(f"manifest 可解析: {len(manifest['icons'])} 个图标")
