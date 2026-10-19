# ImageLab · 图片查看与像素/深度分析

纯静态网页应用，无构建步骤、无后端、无外部 CDN 依赖（TIFF 解码库已内置），把整个目录拷到任意静态服务器即可运行，Linux / Windows 通用。

## 功能

- **图片加载**：点击按钮 / 拖拽 / Ctrl+V 粘贴，支持多张，缩略图列表切换
- **格式支持**：JPG / PNG / WebP / GIF / BMP（浏览器原生解码）；TIFF（含 16bit 单通道深度图、16bit/8bit 彩色，支持 LZW / Deflate / PackBits / 无压缩）
- **鼠标悬停**：光标旁浮动提示 + 侧栏 11×11 放大镜，实时显示坐标、R/G/B、HEX
- **深度图**（TIFF 16bit/32bit 单通道）：悬停显示真实深度值（单位 mm）、全图深度范围、伪彩色映射（Jet / Viridis / 灰度）
- **取色**：单击图片复制颜色（深度图复制深度值），侧栏保存历史记录，点击历史色块再次复制
- **缩放平移**：滚轮以鼠标为中心缩放、拖拽平移、双击适配窗口、高倍放大时显示像素网格

## 深度值约定

- 16bit 整数 TIFF：像素值即毫米数（mm）
- 32bit 浮点 TIFF：按米解析，自动 ×1000 转为 mm
- 像素值 0 视为无效深度（显示为透明），不参与范围统计

## 多语言（中文 / 英文）

站点按**路径**分语言，两种语言各有独立 URL，因此都能被搜索引擎收录：

| 地址 | 语言 |
|---|---|
| `/` | 中文（`lang="zh-CN"`），默认版本 |
| `/en/` | English（`lang="en"`） |

分工：

- **静态文字**直接写在各自的 HTML 里（`index.html` / `en/index.html`）——爬虫不执行 JS 也能读到全文。
- **JS 生成的文字**（toast、深度值、侧栏提示等）统一放在 `js/i18n.js` 的文案表里，代码里用 `t("key", {name: value})` 取。
- 顶栏 `中文 | EN` 是普通链接，不做 JS 重绘；`localStorage` 只用来记录"上次选了另一种语言"，从不自动跳转。
- 两页共用同一套 CSS/JS，所以 **DOM 的 id 必须保持一致**，`deploy/check_i18n.py` 会校验这一点。

改完 js/css 记得把两个 HTML 里 `?v=1` 的版本号加一（这些资源缓存 7 天）。

加第三种语言：复制 `en/index.html` 到 `/ja/index.html`，改 `lang`、`canonical`、`title`/`description`、hreflang，在 `js/i18n.js` 的 `DICT` 里补一份文案，再在 `sitemap.xml` 加一条 URL。

## 本地运行（任选其一）

- 直接双击 `index.html`（零依赖，推荐）
- `python -m http.server 8000`，访问 http://localhost:8000
- `npx serve`

## 部署到 Cloudflare Pages（推荐，免费）

纯静态站点走 Cloudflare Pages 的 Git 集成，push 即上线，自带 HTTPS 和全球 CDN，不需要服务器。
完整步骤见 [`deploy/CLOUDFLARE.md`](deploy/CLOUDFLARE.md)，关键配置：

| 配置项 | 值 |
|---|---|
| Build command | `exit 0` |
| Build output directory | `/` |
| Framework preset | None |

缓存与安全响应头由根目录的 `_headers` 接管（等价于下面 nginx 配置里的 `expires` / `add_header`）。
注意 Pages 的 Git 集成只支持 GitHub / GitLab，不支持 Gitee。

## 部署到 Linux 云服务器（nginx）

```bash
scp -r ./* user@your-server:/var/www/image_show/
```

完整站点配置已包含在 `deploy/image_show.conf`（含反恶意爬虫与静态缓存）：

```bash
scp deploy/image_show.conf user@your-server:/etc/nginx/conf.d/
# 修改 server_name 为实际域名后：
nginx -t && nginx -s reload
```

没有 nginx 的话，`python3 -m http.server 8080` 或 `npx serve -l 80` 也能跑（但无防爬虫能力）。

## 防范恶意爬虫（双层）

| 层级 | 手段 | 对象 |
|---|---|---|
| robots.txt | Disallow 声明 | 守规矩的爬虫：GPTBot/ClaudeBot/Bytespider 等 AI 爬虫、Ahrefs/Semrush 等 SEO 抓虫 |
| nginx（deploy/image_show.conf） | 按 IP 限速 10r/s（超限 429）、并发连接上限、恶意 UA 直接 403、垃圾 Referer 403 | 无视 robots.txt 的恶意爬虫、脚本（scrapy/python-requests 等） |

补充建议：

- 若源站经常被扫，可在服务器装 fail2ban，对 nginx 403/429 日志自动封 IP
- 套 Cloudflare（免费档开 Bot Fight Mode）可挡掉绝大多数恶意流量，配置文件尾部附有真实 IP 还原说明
- 限速阈值（10r/s）如影响正常使用（如多人共用出口 IP 的公司网络），可适当调大 `rate=` 与 `burst=`

## 上线检查清单

- `robots.txt`：把 `Sitemap:` 行中的 `example.com` 替换为实际域名
- `sitemap.xml`：把 `<loc>` 中的 `example.com` 替换为实际域名
- `ads.txt`：接入 AdSense 后填入发布商 ID 并取消注释
- `favicon.ico`：已生成，无需修改（浏览器收藏夹/爬虫自动获取）
- `404.html`：已生成，配合上方 nginx `error_page` 配置生效
- 建议：HTTP 跳 HTTPS（certbot），并给 `index.html` 补充 `<meta name="description">` 描述

## 部署到 Windows

拷入 IIS 站点目录，或在本目录执行 `python -m http.server 8080`。

## 广告接入

`index.html` 中有两个带注释的广告位容器：

- 顶部横幅 `div.ad-slot.ad-top`（728 × 90）
- 侧栏 `div.ad-slot.ad-side`（300 × 600）

接入 Google AdSense：在 `<head>` 中加入 AdSense 脚本，把容器内的占位 `<span>` 替换为 `ins.adsbygoogle` 代码块即可，容器尺寸已按标准广告位预留。接入后记得在站点根目录放置 `ads.txt`。

## 目录结构

```
index.html      中文页面骨架与广告位
en/index.html   英文页面（同结构，lang="en"，资源用根绝对路径）
404.html        自定义 404 页（中英双语）
robots.txt      爬虫规则：放行广告抓取器，屏蔽 AI 训练/SEO 抓虫（君子协定层）
sitemap.xml     站点地图（中文 + 英文两个 URL，带 hreflang 互指）
ads.txt         广告授权文件（AdSense 接入后填写发布商 ID）
favicon.ico     站点图标
site.webmanifest  PWA 清单（图标 192/512）
wrangler.jsonc  Workers 静态资源配置：自定义 404 需要它（仅 npx wrangler deploy 生效）
_headers        Cloudflare Pages 响应头：缓存策略与安全头（替代 nginx 的 expires/add_header）
.assetsignore   Cloudflare Pages 发布排除清单（不让 README/deploy 变成网页）
deploy/
  CLOUDFLARE.md    Cloudflare 部署分步手册（GitHub 集成 + 防爬设置）
  image_show.conf  nginx 完整配置：限速/恶意UA拦截/垃圾Referer拦截/静态缓存
  check_seo.py     SEO 自检：h1/canonical/og:image/JSON-LD/图标
  check_i18n.py    多语言自检：中英页面配对、id 一致、文案 key 无缺失
  make_og_image.py 生成分享图与 PWA 图标（需要 Pillow）
img/            分享图 og-cover.png(1200×630) 与 PWA 图标
css/style.css   深色工具风样式
js/i18n.js      多语言文案表与 t()（只存 JS 动态生成的文字）
js/decoder.js   图片解码（原生 + UTIF/TIFF）、深度伪彩色
js/viewer.js    Canvas 渲染、缩放平移、像素网格
js/inspector.js 悬停像素信息（浮动提示 + 放大镜）
js/picker.js    取色与剪贴板复制
js/main.js      入口：文件加载、列表切换、事件接线
lib/utif.js     TIFF 解码库（photopea/UTIF.js，MIT 协议）
```
