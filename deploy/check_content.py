"""内容页自检：head 完整性、中英配对、站内链接、FAQ 结构化数据、sitemap。

用法：python deploy/check_content.py   （路径以脚本位置推算，可在任意目录运行）
退出码：全部通过为 0，任一 FAIL 为 1。

分批交付说明（docs/content-spec.md 第 10 节）：
  PAGES 按批次扩充：批 1 = depth-tiff 中英，批 2 = 另两篇 guides 中英，
  批 3 = faq/about/privacy 中英（共 12 页）；
  EXPECTED_SITEMAP：批 1/批 2 = 2，批 3（本状态）= 14，sitemap 整体重写完成；
  正文里指向「尚未交付但已规划」页面的链接由 PLANNED_URLS 放行，
  全部交付后这些 URL 都对应真实文件，检查即为真实校验。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://yangzixiong.com"

# 本批已交付页面：(语言, 相对仓库的文件路径, 站点路径)
PAGES = [
    ("zh", "guides/depth-tiff.html", "/guides/depth-tiff"),
    ("en", "en/guides/depth-tiff.html", "/en/guides/depth-tiff"),
    ("zh", "guides/color-picker.html", "/guides/color-picker"),
    ("en", "en/guides/color-picker.html", "/en/guides/color-picker"),
    ("zh", "guides/pixel-inspector.html", "/guides/pixel-inspector"),
    ("en", "en/guides/pixel-inspector.html", "/en/guides/pixel-inspector"),
    ("zh", "faq.html", "/faq"),
    ("en", "en/faq.html", "/en/faq"),
    ("zh", "about.html", "/about"),
    ("en", "en/about.html", "/en/about"),
    ("zh", "privacy.html", "/privacy"),
    ("en", "en/privacy.html", "/en/privacy"),
    ("zh", "tools/histogram.html", "/tools/histogram"),
    ("en", "en/tools/histogram.html", "/en/tools/histogram"),
    ("zh", "tools/flip.html", "/tools/flip"),
    ("en", "en/tools/flip.html", "/en/tools/flip"),
    ("zh", "tools/crop.html", "/tools/crop"),
    ("en", "en/tools/crop.html", "/en/tools/crop"),
    ("zh", "tools/grid.html", "/tools/grid"),
    ("en", "en/tools/grid.html", "/en/tools/grid"),
    ("zh", "tools/remove-bg.html", "/tools/remove-bg"),
    ("en", "en/tools/remove-bg.html", "/en/tools/remove-bg"),
]

# 计划中的最终 URL 全集（链接指向此处视为有效）
PLANNED_URLS = {
    "/", "/en/",
    "/guides/depth-tiff.html", "/guides/color-picker.html", "/guides/pixel-inspector.html",
    "/faq.html", "/about.html", "/privacy.html",
    "/en/guides/depth-tiff.html", "/en/guides/color-picker.html", "/en/guides/pixel-inspector.html",
    "/en/faq.html", "/en/about.html", "/en/privacy.html",
    "/tools/histogram.html", "/tools/flip.html", "/tools/crop.html", "/tools/grid.html", "/tools/remove-bg.html",
    "/en/tools/histogram.html", "/en/tools/flip.html", "/en/tools/crop.html", "/en/tools/grid.html", "/en/tools/remove-bg.html",
}

EXPECTED_SITEMAP = 24  # 2 个首页 + 12 个内容页 + 10 个工具页（histogram/flip/crop/grid/remove-bg × 中英）

# 不得被删除/破坏的既有资源（spec 第 9.10 条）
EXPECTED_ASSETS = [
    "css/style.css",
    "js/i18n.js", "js/decoder.js", "js/viewer.js", "js/inspector.js", "js/picker.js", "js/main.js",
    "js/toolkit.js", "tools/histogram.js", "tools/flip.js", "tools/crop.js", "tools/grid.js", "tools/remove-bg.js",
    "lib/utif.js", "lib/fflate.js",
    "lib/ort/ort.min.js", "lib/ort/ort-wasm-simd-threaded.mjs", "lib/ort/ort-wasm-simd-threaded.wasm",
    "models/modnet-uint8.onnx", "models/u2netp.onnx",
]

ok = True


def check(cond, msg):
    global ok
    print(("OK   " if cond else "FAIL ") + msg)
    if not cond:
        ok = False


def attr(html, pattern):
    m = re.search(pattern, html)
    return m.group(1).strip() if m else None


def href_to_path(href, page_path):
    """把页面里的 href 解析成仓库内路径；外部协议返回 None，目录 URL 补 index.html，无扩展名路径补 .html。"""
    href = href.split("?")[0].split("#")[0]
    if not href or href.startswith(("data:", "http:", "https:", "mailto:", "tel:")):
        return None
    if href.endswith("/"):
        href += "index.html"
    elif not Path(href).suffix:
        href += ".html"
    if href.startswith("/"):
        rel = href[1:]
    else:
        rel = str(Path(page_path).parent / href).replace("\\", "/")
    if rel.startswith("../"):
        return None  # 指向仓库外，本站不应出现
    return str(Path(rel))


# ---- 逐页检查 ----
for lang, rel, site_path in PAGES:
    p = ROOT / rel
    label = "[{}] {}".format(lang, rel)
    if not p.exists():
        check(False, f"{label} 文件存在")
        continue
    html = p.read_text(encoding="utf-8")
    check(True, f"{label} 文件存在")

    title = attr(html, r"<title>(.*?)</title>")
    desc = attr(html, r'<meta name="description" content="([^"]*)"')
    check(title is not None and len(title) > 0, f"{label} title 非空")
    if title:
        limit = 30 if lang == "zh" else 60
        check(len(title) <= limit, f"{label} title 长度 {len(title)} <= {limit}")
    check(desc is not None and len(desc) > 0, f"{label} description 非空")
    if desc:
        lo, hi = (60, 120) if lang == "zh" else (120, 160)
        check(lo <= len(desc) <= hi, f"{label} description 长度 {len(desc)} 在 {lo}-{hi}")

    h1s = re.findall(r"<h1\b[^>]*>(.*?)</h1>", html, re.S)
    check(len(h1s) == 1, f"{label} 恰好 1 个 <h1>（实际 {len(h1s)}）")
    check(bool(h1s) and h1s[0].strip() != "", f"{label} <h1> 内容非空")

    canonical = attr(html, r'rel="canonical" href="([^"]+)"')
    check(canonical == BASE + site_path, f"{label} canonical = {BASE + site_path}")

    zh_path = site_path.replace("/en/", "/", 1) if lang == "en" else site_path
    en_path = "/en" + site_path if lang == "zh" else site_path
    a1 = 'rel="alternate" hreflang="zh-CN" href="' + BASE + zh_path + '"'
    a2 = 'rel="alternate" hreflang="en" href="' + BASE + en_path + '"'
    a3 = 'rel="alternate" hreflang="x-default" href="' + BASE + zh_path + '"'
    check(a1 in html and a2 in html and a3 in html, f"{label} hreflang 三条齐全且互指正确")

    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
    if m:
        try:
            json.loads(m.group(1))
            check(True, f"{label} JSON-LD 可解析")
        except ValueError as e:
            check(False, f"{label} JSON-LD 可解析（{e}）")
    else:
        check(False, f"{label} JSON-LD 存在")

    check(bool(re.search(r"css/style\.css\?v=4", html)), f"{label} 样式表引用为 ?v=3")

    broken = []
    for href in re.findall(r'href="([^"]+)"', html):
        target = href_to_path(href, rel)
        if target is None:
            continue
        if (ROOT / target).exists():
            continue
        if ("/" + target.replace("\\", "/")) in PLANNED_URLS:
            continue
        broken.append(href)
    check(not broken, f"{label} 站内链接全部有效")
    for b in broken:
        print("      失效:", b)

# ---- FAQ 专项（faq.html 进入 PAGES 后自动生效）----
for lang, rel, site_path in PAGES:
    if not rel.endswith("faq.html"):
        continue
    p = ROOT / rel
    if not p.exists():
        continue
    html = p.read_text(encoding="utf-8")
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
    n_q = len(re.findall(r"<h3\b", html))
    if m:
        try:
            data = json.loads(m.group(1))
            n_ld = len(data.get("mainEntity", []))
            check(data.get("@type") == "FAQPage", f"[{lang}] faq JSON-LD 为 FAQPage")
            check(n_ld == n_q, f"[{lang}] faq mainEntity({n_ld}) = 页面 <h3> 数({n_q})")
        except ValueError:
            check(False, f"[{lang}] faq JSON-LD 可解析")

# ---- sitemap ----
try:
    import xml.etree.ElementTree as ET
    tree = ET.parse(ROOT / "sitemap.xml")
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [e.text for e in tree.findall(".//s:loc", ns)]
    check(len(locs) == EXPECTED_SITEMAP, f"sitemap 含 {EXPECTED_SITEMAP} 个 <loc>（实际 {len(locs)}）")
    check(all(l.startswith(BASE) for l in locs), "sitemap 所有 URL 指向本站")
except Exception as e:
    check(False, f"sitemap 可解析（{e}）")

# ---- 既有资源未删除 ----
for asset in EXPECTED_ASSETS:
    check((ROOT / asset).exists(), f"资源存在: {asset}")

# ---- 全站 ?v=3（所有引用 style.css 的页面）----
stale = []
for html_file in sorted(ROOT.rglob("*.html")):
    text = html_file.read_text(encoding="utf-8")
    if "style.css" in text and "style.css?v=4" not in text:
        stale.append(html_file.relative_to(ROOT).as_posix())
check(not stale, "所有引用样式表的页面均使用 ?v=3")
for s in stale:
    print("      未升级:", s)

print()
print("全部通过" if ok else "存在未通过项")
sys.exit(0 if ok else 1)
