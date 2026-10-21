# -*- coding: utf-8 -*-
"""把 js/lang-boot.js 内联进所有页面 <head>（消除渲染阻塞的外部请求）。

设计：js/lang-boot.js 是唯一源码，页面里是带标记的内联副本——
  <script>
  /* lang-boot:begin */
  ...源码内容...
  /* lang-boot:end */
  </script>
改了源码后重跑本脚本即可全站同步；check_content.py 会校验副本与源文件一致，防止漂移。

用法：
  python deploy/inline_langboot.py           # 批量写入（幂等）
  python deploy/inline_langboot.py --check   # 只校验，返回错误列表
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "js" / "lang-boot.js"
EXTERNAL = '<script src="/js/lang-boot.js?v=1"></script>'
B1 = "/* lang-boot:begin */"
B2 = "/* lang-boot:end */"
BLOCK_RE = re.compile(r"<script>\s*" + re.escape(B1) + r"(.*?)" + re.escape(B2) + r"\s*</script>", re.S)


def pages():
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith(("docs/", "deploy/")) or rel == "404.html":
            continue
        yield p, rel


def build_block(code):
    return "<script>\n" + B1 + "\n" + code.rstrip("\n") + "\n" + B2 + "\n</script>"


def verify():
    """返回错误信息列表（空 = 全部一致）。"""
    code = SRC.read_text(encoding="utf-8").strip()
    errors = []
    for p, rel in pages():
        t = p.read_text(encoding="utf-8")
        if EXTERNAL in t:
            errors.append(rel + ": 仍是外链 script（未内联）")
            continue
        m = BLOCK_RE.search(t)
        if not m:
            errors.append(rel + ": 缺少 lang-boot 内联标记块")
            continue
        if m.group(1).strip() != code:
            errors.append(rel + ": 内联副本与 js/lang-boot.js 不一致")
    return errors


def main():
    if "--check" in sys.argv:
        errors = verify()
        for e in errors:
            print("FAIL " + e)
        print("lang-boot 内联一致" if not errors else "%d 处不一致" % len(errors))
        return 0 if not errors else 1

    code = SRC.read_text(encoding="utf-8")
    block = build_block(code)
    done, changed = [], 0
    for p, rel in pages():
        t0 = t = p.read_text(encoding="utf-8")
        if EXTERNAL in t:
            t = t.replace(EXTERNAL, block, 1)
        elif BLOCK_RE.search(t):
            t = BLOCK_RE.sub(lambda m: block if m.group(1).strip() != code.strip() else m.group(0), t, count=1)
        else:
            print("SKIP " + rel + ": 找不到 lang-boot 引用位置")
            continue
        if t != t0:
            p.write_text(t, encoding="utf-8", newline="\n")
            changed += 1
        done.append(rel)
    print("pages: %d, rewritten: %d" % (len(done), changed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
