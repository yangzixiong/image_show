"""生成站点分享图与图标（一次性脚本，产物提交到 img/）。

用法：
    python deploy/make_og_image.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "img"
OUT.mkdir(exist_ok=True)

BG = (15, 18, 22)
PANEL = (22, 27, 34)
BORDER = (42, 50, 61)
TEXT = (213, 219, 228)
MUTED = (138, 148, 163)
ACCENT = (79, 140, 255)
ACCENT2 = (103, 213, 161)

FONT_DIR = Path("C:/Windows/Fonts")


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for candidate in (name, "msyh.ttc", "segoeui.ttf"):
        p = FONT_DIR / candidate
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except OSError:
                continue
    return ImageFont.load_default()


def rounded(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_og() -> Path:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # 顶部强调条
    d.rectangle([0, 0, W, 8], fill=ACCENT)

    # 右侧像素网格装饰
    cell, gap = 44, 8
    ox, oy = 880, 250
    for r in range(4):
        for c in range(3):
            x = ox + c * (cell + gap)
            y = oy + r * (cell + gap)
            if (r + c) % 5 == 0:
                color = ACCENT2
            elif (r + c) % 2 == 0:
                color = ACCENT
            else:
                color = PANEL
            rounded(d, [x, y, x + cell, y + cell], 8, fill=color)

    # 主标题
    d.text((88, 150), "ImageLab", font=font("seguibl.ttf", 104), fill=(255, 255, 255))
    d.text((92, 285), "在线图片像素与深度查看器", font=font("msyhbd.ttc", 46), fill=TEXT)
    d.text((94, 362), "RGB / HEX 取色 · 16bit TIFF 深度图 · 像素网格",
           font=font("msyh.ttc", 28), fill=MUTED)

    # 三枚功能标签
    labels = ["纯本地处理", "无需上传", "免费"]
    x = 94
    for text in labels:
        f = font("msyh.ttc", 24)
        w = int(d.textlength(text, font=f)) + 34
        rounded(d, [x, 448, x + w, 500], 26, fill=PANEL, outline=BORDER, width=2)
        d.text((x + 17, 458), text, font=f, fill=ACCENT2)
        x += w + 14

    # 底部域名
    d.text((94, 552), "yangzixiong.com",
           font=font("consola.ttf", 26), fill=MUTED)

    path = OUT / "og-cover.png"
    img.save(path, optimize=True)
    return path


def make_icon(size: int) -> Path:
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    scale = size / 180
    pad = int(28 * scale)
    cell = int(34 * scale)
    gap = int(8 * scale)
    start = pad
    for r in range(3):
        for c in range(3):
            x = start + c * (cell + gap)
            y = start + r * (cell + gap)
            color = ACCENT2 if (r, c) == (1, 1) else ACCENT
            rounded(d, [x, y, x + cell, y + cell], max(2, int(6 * scale)), fill=color)
    path = OUT / ("apple-touch-icon.png" if size == 180 else f"icon-{size}.png")
    img.save(path, optimize=True)
    return path


if __name__ == "__main__":
    for p in [make_og(), make_icon(180), make_icon(192), make_icon(512)]:
        print(f"{p.relative_to(ROOT)}  {p.stat().st_size} bytes")
