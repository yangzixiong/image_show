"""多语言自检：中英文页面是否配对、资源是否齐全、i18n 文案表是否缺 key。

用法：python deploy/check_i18n.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = {  # 语言 -> 页面文件
    "zh": ROOT / "index.html",
    "en": ROOT / "en" / "index.html",
}
BASE = "https://yangzixiong.com"

ok = True


def check(cond, msg):
    global ok
    print(("OK   " if cond else "FAIL ") + msg)
    if not cond:
        ok = False


def local_refs(html):
    """抽出页面引用的本地静态资源路径（去掉 ?v= 查询串）。"""
    refs = set()
    for pat in (r'src="([^"]+)"', r'href="([^"]+)"'):
        for m in re.finditer(pat, html):
            url = m.group(1)
            if url.startswith(("data:", "http:", "https:", "#", "mailto:")):
                continue
            url = url.split("?")[0].split("#")[0]
            if url.endswith("/"):
                url += "index.html"
            elif "." not in url.rsplit("/", 1)[-1]:
                url += ".html"
            if url.startswith("/"):
                url = url[1:]
            refs.add(url)
    return refs


def ids(html):
    return set(re.findall(r'\bid="([^"]+)"', html))


htmls = {}
for lang, path in PAGES.items():
    check(path.exists(), f"{lang} 页面存在: {path.relative_to(ROOT)}")
    if path.exists():
        htmls[lang] = path.read_text(encoding="utf-8")

# 1) lang 属性
check('lang="zh-CN"' in htmls["zh"], "中文页 <html lang=\"zh-CN\">")
check('lang="en"' in htmls["en"], "英文页 <html lang=\"en\">")

# 2) canonical 各指自己，且不含占位域名
for lang, want in (("zh", BASE + "/"), ("en", BASE + "/en/")):
    m = re.search(r'rel="canonical" href="([^"]+)"', htmls[lang])
    check(bool(m) and m.group(1) == want, f"{lang} canonical = {want}")

for lang, html in htmls.items():
    check("example.com" not in html, f"{lang} 页面无 example.com 占位域名")

# 3) hreflang 三条齐全，两页一致
alt_zh = f'<link rel="alternate" hreflang="zh-CN" href="{BASE}/">'
alt_en = f'<link rel="alternate" hreflang="en" href="{BASE}/en/">'
alt_x = f'<link rel="alternate" hreflang="x-default" href="{BASE}/">'
for lang, html in htmls.items():
    check(alt_zh in html and alt_en in html and alt_x in html, f"{lang} 页 hreflang 三条齐全")

# 4) 两页 DOM 骨架一致（id 集合相同），否则共用 JS 会在某一边报错
check(ids(htmls["zh"]) == ids(htmls["en"]),
      "中英页面 id 集合一致（共用同一套 JS）")
if ids(htmls["zh"]) != ids(htmls["en"]):
    print("   仅中文有:", sorted(ids(htmls["zh"]) - ids(htmls["en"])))
    print("   仅英文有:", sorted(ids(htmls["en"]) - ids(htmls["zh"])))

# 5) 本地资源都存在（英文页用根绝对路径，仍映射到仓库根）
# 批4 后 12 个工具页全部交付，无规划中放行项
PLANNED = set()
missing = set()
for lang, html in htmls.items():
    for ref in local_refs(html):
        if not ref or ref.endswith("/"):
            continue
        if ref in PLANNED:
            continue
        if not (ROOT / ref).exists():
            missing.add(ref)
check(not missing, "页面引用的本地资源全部存在（规划中 URL 除外）")
for ref in sorted(missing):
    print("   缺失:", ref)

# 6) 语言切换互相指向
check('href="/en/"' in htmls["zh"] and 'data-lang-switch="en"' in htmls["zh"],
      "中文页 → /en/ 切换入口")
check(re.search(r'href="/"\s+[^>]*data-lang-switch="zh"', htmls["en"]) is not None,
      "英文页 → / 切换入口")

# 7) i18n 文案表：中英 key 必须完全一致
i18n_src = (ROOT / "js" / "i18n.js").read_text(encoding="utf-8")
zh_block = i18n_src.split("zh: {", 1)[1].split("\n    en: {", 1)[0]
en_block = i18n_src.split("en: {", 1)[1].split("\n    }\n  };", 1)[0]
zh_keys = set(re.findall(r'"([\w.]+)"\s*:', zh_block))
en_keys = set(re.findall(r'"([\w.]+)"\s*:', en_block))
check(zh_keys == en_keys, f"中英文案 key 一致（{len(zh_keys)} 条）")
for k in sorted(zh_keys - en_keys):
    print("   英文缺:", k)
for k in sorted(en_keys - zh_keys):
    print("   中文缺:", k)

# 8) JS 里用到的 key 必须都在表里
used = set()
scripts = list((ROOT / "js").glob("*.js")) + list((ROOT / "tools").glob("*.js"))
for js in sorted(scripts):
    if js.name == "i18n.js":
        continue
    used |= set(re.findall(r'\bt\(\s*"([\w.]+)"', js.read_text(encoding="utf-8")))
check(used and used <= zh_keys, f"JS 用到的 {len(used)} 个 key 都有中文文案")
for k in sorted(used - zh_keys):
    print("   未定义:", k)

# 9) sitemap 收录两种语言
sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
check(BASE + "/</loc>" in sitemap and BASE + "/en/</loc>" in sitemap,
      "sitemap 收录中文与英文两个 URL")
check(sitemap.count('hreflang="en"') >= 2, "sitemap 带 hreflang 互指")

# 10) 跨语言链接必须带 data-lang-switch：
#     lang-boot 在 document 上委托监听该属性并保存 imagelab.lang，
#     属性缺失时点击不落偏好，目标页会按浏览器语言把用户自动切回（2026-10-21 修复的回归）。
A_TAG = re.compile(r"<a\s[^>]*>", re.S)
HREF = re.compile(r'href="([^"#?]*)')
bare, badval = [], []
tagged = 0
for p in sorted(ROOT.rglob("*.html")):
    rel = p.relative_to(ROOT).as_posix()
    if rel.startswith(("docs/", "deploy/")):
        continue
    is_en = rel.startswith("en/")
    page = p.read_text(encoding="utf-8")
    for m in A_TAG.finditer(page):
        tag = m.group(0)
        vm = re.search(r'data-lang-switch="([^"]*)"', tag)
        if vm:
            tagged += 1
            if vm.group(1) not in ("en", "zh"):
                badval.append(rel + ": " + tag.strip()[:100])
            continue
        hm = HREF.search(tag)
        if not hm:
            continue
        href = hm.group(1)
        if not href.startswith("/") or href.startswith("//"):
            continue
        cross = href.startswith("/en") if not is_en else (href == "/" or not href.startswith("/en"))
        if cross:
            bare.append(rel + ": " + tag.strip()[:100])
check(not bare, f"跨语言 <a> 全部带 data-lang-switch（已标记 {tagged} 处）")
for b in bare[:10]:
    print("   缺属性:", b)
check(not badval, "data-lang-switch 取值只允许 en|zh")
for b in badval[:10]:
    print("   非法值:", b)

print()
print("全部通过" if ok else "存在未通过项")
sys.exit(0 if ok else 1)
