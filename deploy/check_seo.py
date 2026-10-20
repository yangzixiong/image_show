"""一次性自检：SEO head、JSON-LD、静态资源是否齐备。

定位改版（docs/opencode-task-positioning.md 批 2）后：
  index.html 是工具箱目录页 —— 要求恰好 1 个 <h1>、canonical、JSON-LD 为 CollectionPage；
  原查看器的 SoftwareApplication/featureList 检查移至 tools/pixel-viewer.html。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text(encoding="utf-8")

ok = True


def check(cond, msg):
    global ok
    print(("OK   " if cond else "FAIL ") + msg)
    if not cond:
        ok = False


checks = {
    "canonical": 'rel="canonical"',
    "og:image": 'property="og:image"',
    "og:url": 'property="og:url"',
    "twitter:card 大图": "summary_large_image",
    "apple-touch-icon": "apple-touch-icon",
    "manifest": 'rel="manifest"',
    "theme-color": 'name="theme-color"',
    "ld+json": "application/ld+json",
}
for name, needle in checks.items():
    check(needle in html, name)

n_h1 = len(re.findall(r"<h1\b", html))
check(n_h1 == 1, f"首页 <h1> 数量 = 1（实际 {n_h1}）")

m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
data = json.loads(m.group(1))
check(data.get("@type") == "CollectionPage", f"首页 JSON-LD 可解析且为 CollectionPage（实际 {data.get('@type')}）")

items = data.get("mainEntity", {}).get("itemListElement", [])
check(len(items) >= 12, f"ItemList 工具条目 {len(items)} 条")

# featureList 检查已随查看器迁移到 /tools/pixel-viewer
viewer = (ROOT / "tools" / "pixel-viewer.html").read_text(encoding="utf-8")
m2 = re.search(r'<script type="application/ld\+json">(.*?)</script>', viewer, re.S)
data2 = json.loads(m2.group(1))
fl = data2.get("featureList", [])
check(bool(fl), f"查看器 JSON-LD featureList={len(fl)} 条")

for rel in ["img/og-cover.png", "img/apple-touch-icon.png", "img/icon-192.png",
            "img/icon-512.png", "site.webmanifest", "wrangler.jsonc"]:
    p = ROOT / rel
    check(p.exists(), rel)

manifest = json.loads((ROOT / "site.webmanifest").read_text(encoding="utf-8"))
print(f"manifest 可解析: {len(manifest['icons'])} 个图标")

print()
print("全部通过" if ok else "存在未通过项")
sys.exit(0 if ok else 1)
