# ImageLab · AI 绘图与图片处理工具箱

为 AI 绘图与图片处理准备的浏览器工具——图片和提示词都不上传。纯静态网页应用，无构建步骤、无后端、无外部 CDN 依赖（TIFF 解码库已内置），把整个目录拷到任意静态服务器即可运行，Linux / Windows 通用。

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
- 顶栏 `中文 | EN` 是普通链接，不做 JS 重绘；`localStorage`（`imagelab.lang`）只记录用户**显式点过**的语言。首访时 `js/lang-boot.js` 按 `navigator.languages` 自动切换语言（head 内执行、无闪烁；爬虫与无头浏览器跳过，点过开关后永不再跳）。
- 两页共用同一套 CSS/JS，所以 **DOM 的 id 必须保持一致**，`deploy/check_i18n.py` 会校验这一点。

改完 js/css 记得把各 HTML 里对应的 `?v=` 版本号加一（当前 toolkit/i18n 为 `?v=3`、promptlib 为 `?v=2`、`style.css` 为 `?v=5`，页面脚本从 `?v=1` 起；这些资源缓存 7 天）。

加第三种语言：复制 `en/index.html` 到 `/ja/index.html`，改 `lang`、`canonical`、`title`/`description`、hreflang，在 `js/i18n.js` 的 `DICT` 里补一份文案，再在 `sitemap.xml` 加一条 URL。

## 工具页（一功能一页，便于被单独搜索到）

| 路径 | 功能 |
|---|---|
| `/tools/histogram` · `/en/tools/histogram` | 图片直方图：RGB/亮度分布、对数刻度、溢出百分比、16bit 深度图分布 |
| `/tools/flip` · `/en/tools/flip` | 翻转 / 旋转 / 镜像，导出 PNG / JPEG / WebP |
| `/tools/crop` · `/en/tools/crop` | 固定比例裁剪（1:1 / 4:3 / 16:9 / 9:16 等），长边 512/768/1024 输出，PNG 无损导出 |
| `/tools/grid` · `/en/tools/grid` | 九宫格 / 四宫格 / 自定义行列分割，逐块无损 PNG 打包 zip 下载（fflate） |
| `/tools/remove-bg` · `/en/tools/remove-bg` | 浏览器内 ONNX 抠图：人像 MODNet / 通用 U2Netp 双模型，透明 PNG + 黑白遮罩（ControlNet 可用） |
| `/tools/prompt-weight` · `/en/tools/prompt-weight` | SD 提示词权重计算器：(word)/[word]/{word}/(word:1.3) 解析、A1111 与 ComfyUI 方言、色带与错误点击定位、CLIP token 粗估 |
| `/tools/prompt-split` · `/en/tools/prompt-split` | 提示词正反词分离：JSON / Positive:/Negative prompt 标签 / ### 分隔线 / --no / 空行 五种格式自动识别，三栏分别复制 |
| `/tools/negative-prompt` · `/en/tools/negative-prompt` | 负面提示词库：四组词条勾选拼接、跨组自动去重、自定义补充，正反一对整段复制 |
| `/tools/random-prompt` · `/en/tools/random-prompt` | 随机提示词生成器：画质/主体/动作/场景/光照/镜头六层加权抽取，单层锁定与重抽、种子复现与分享链接、标签流/自然语言双输出 |
| `/tools/prompt-translate` · `/en/tools/prompt-translate` | 提示词翻译：中英标签双向逐条对照，同义词归一，1girl/8k 等固定写法整词保留，未收录词单独列出 |
| `/tools/token-counter` · `/en/tools/token-counter` | Token 计数器：CLIP 按 BREAK 分段计数并标出超限段（77/段）、T5-XXL 512 上限、o200k_base 与 cl100k_base 精确计数，词表离线内置按需加载 |

新增工具页的约定：

- 页面放 `tools/<name>.html`（英文 `en/tools/<name>.html`），逻辑放 `tools/<name>.js`，共用能力放 `js/toolkit.js`（选文件、拖放、下载、格式化、toast）与 `js/decoder.js`（解码，含 16bit TIFF）。
- 页面 `body` 用 `class="doc tool"`，样式类 `.tool-main` / `.dropzone` / `.tool-grid` / `.tool-notes` / `.related` 已在 `css/style.css` 里备好。
- 脚本加载顺序：图像类工具页为 `i18n.js` → `lib/utif.js` → `decoder.js` → `toolkit.js` → 本页脚本；提示词类页面为 `toolkit.js` → `js/promptlib.js` → 本页脚本（各带自己的 `?v=`）。
- 图像页的新文案写进 `js/i18n.js` 的中英两份 `DICT`（两份 key 必须一致，`deploy/check_i18n.py` 会校验）；提示词页的运行时文案写在各自 js 顶部的本地 `DICT`，用 `tt()` 取。
- 新页要同时改：`sitemap.xml`、`deploy/check_content.py` 的 `PAGES`/`PLANNED_URLS`/`EXPECTED_SITEMAP`、以及各个页脚的站内导航。

## 本地运行（任选其一）

- 直接双击 `index.html`（零依赖，推荐）
- `python -m http.server 8000`，访问 http://localhost:8000
- `npx serve`

## 部署到 Cloudflare（推荐，免费）

纯静态站点走 Workers 静态资源 + Git 集成（当前实际方式，push 到 `main` 即自动上线），自带 HTTPS 和全球 CDN，不需要服务器。
完整步骤见 [`deploy/CLOUDFLARE.md`](deploy/CLOUDFLARE.md)；Pages 时代的关键配置（历史参考）：

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
sitemap.xml     站点地图（2 个首页 + 12 个内容页 + 24 个工具页共 38 条 URL，带 hreflang 互指）
guides/ faq.html about.html privacy.html  内容页（英文版在 en/ 下，成对互指）
tools/          工具页：histogram 直方图、flip 翻转旋转、crop 裁剪、grid 网格分割、remove-bg 抠图、prompt-weight 权重计算器、prompt-split 正反词分离、negative-prompt 负面词库、random-prompt 随机生成、prompt-translate 提示词翻译、token-counter Token 计数器（均为 .html，英文版在 en/tools/ 下）
ads.txt         广告授权文件（AdSense 接入后填写发布商 ID）
favicon.ico     站点图标
site.webmanifest  PWA 清单（图标 192/512）
wrangler.jsonc  Workers 静态资源配置：自定义 404 需要它（Git 构建与 wrangler deploy 均生效）
_headers        Cloudflare 响应头（Pages/Workers 通用）：缓存策略与安全头（替代 nginx 的 expires/add_header）
.assetsignore   发布排除清单（Workers/Pages 通用，不让 README/deploy/docs 变成网页）
docs/            站点定位与内容规范：positioning-spec.md（定位/URL/SEO）、opencode-task-positioning.md（改版任务书），不上线
deploy/
  CLOUDFLARE.md    Cloudflare 部署分步手册（GitHub 集成 + 防爬设置）
  image_show.conf  nginx 完整配置：限速/恶意UA拦截/垃圾Referer拦截/静态缓存
  check_seo.py     SEO 自检：h1/canonical/og:image/JSON-LD/图标
  check_i18n.py    多语言自检：中英页面配对、id 一致、文案 key 无缺失
  check_content.py 内容页自检：36 个内容页/工具页的 title/description/hreflang/JSON-LD/站内链接与 sitemap 条数
  make_og_image.py 生成分享图与 PWA 图标（需要 Pillow）
img/            分享图 og-cover.png(1200×630) 与 PWA 图标
css/style.css   深色工具风样式（含工具页布局类）
data/           静态数据：negative-prompts.json 负面词条库（四组 56 条）、random-prompts.json 随机池（六层 146 条带权重）、prompt-terms.json 中英词条（189 条含同义词与固定写法），label 均为中英两份；tok/ 为 Token 计数器的离线词表（打开该页才 fetch）
js/i18n.js      多语言文案表与 t()（只存 JS 动态生成的文字）
js/toolkit.js   工具页共用：选文件、拖放、下载、体积格式化、toast
js/decoder.js   图片解码（原生 + UTIF/TIFF）、深度伪彩色
js/viewer.js    Canvas 渲染、缩放平移、像素网格
js/inspector.js 悬停像素信息（浮动提示 + 放大镜）
js/picker.js    取色与剪贴板复制
js/main.js      入口：文件加载、列表切换、事件接线
js/promptlib.js 提示词纯逻辑库：权重解析 / 正反拆分 / 负面拼接 / 分词计数（CLIP 粗估 + CLIP/cl100k/o200k 精确词表，与官方实现交叉验证一致）/ 词表载入（无 DOM、无 i18n）
tools/histogram.js  直方图统计（采样上限 200 万）与三种绘制模式
tools/flip.js       翻转旋转的变换矩阵与导出
tools/crop.js       比例裁剪框（Pointer 拖拽）与按长边缩放导出
tools/grid.js       行列网格切块与 fflate zip 打包
tools/remove-bg.js  ONNX 抠图管线（按需加载 ort 与模型、遮罩合成与导出）
tools/prompt-weight.js   权重计算器页面：色带 chips、方言切换与原文定位
tools/prompt-split.js    正反词分离页面：识别提示与三栏回写、分别复制
tools/negative-prompt.js 负面词库页面：词条载入、勾选拼接与正反一对复制
tools/random-prompt.js   随机生成页面：加权抽取、锁定/重抽、种子与分享链接
tools/prompt-translate.js 提示词翻译页面：双向逐条对照、未收录区
tools/token-counter.js   Token 计数器页面：模型切换、词表按需载入与分段展示
lib/utif.js     TIFF 解码库（photopea/UTIF.js，MIT 协议）
lib/fflate.js   zip 打包库（fflate 0.8.2 UMD 版，MIT 协议）
lib/ort/        onnxruntime-web 1.22.0 wasm 后端（MIT 协议，按需加载）
models/         ONNX 模型：modnet-uint8（人像，Apache-2.0）、u2netp（通用，Apache-2.0）
data/tok/       离线词表：clip-vocab.json + clip-merges.txt（OpenAI CLIP BPE，MIT）、cl100k_base.tiktoken + o200k_base.tiktoken（OpenAI tiktoken 编码，MIT）；仅 token-counter 页加载
```
