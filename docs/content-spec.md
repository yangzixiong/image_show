# ImageLab 内容页开发任务书（交给 opencode 执行）

> 本文档是给 AI 编码代理（opencode）的完整任务说明。执行前请读完「硬约束」和「禁止事项」两节。
> 仓库根目录：`D:\yzx_workspace\image_show`，线上地址：`https://yangzixiong.com`

---

## 1. 背景

ImageLab 是一个纯静态的图片像素 / 深度查看器：

- 无构建步骤、无后端、无外部 CDN、无 npm 依赖（TIFF 解码库 `lib/utif.js` 已内置）
- 中文页在根目录，英文页在 `/en/`，按路径分语言，两页共用同一套 `css/style.css` 与 `js/*.js`
- 已完成的 SEO 基础设施：`canonical`、`hreflang`、`og:*`、JSON-LD、`sitemap.xml`、`_headers`、`404.html`
- 目前站点只有**工具页本身**，几乎没有任何文本内容。搜索引擎无法从纯工具页判断站点主题，因此需要 6 组内容页（中英各一份，共 12 个 HTML）

**本次任务的目标**：补齐这 12 个内容页 + 站内导航 + sitemap + 自检脚本。不涉及任何 JS 功能改动。

---

## 2. 硬约束

1. **纯静态**：只能用 HTML/CSS 和已有 JS。不得引入框架、构建工具、npm 包、外部字体、外部图片、外部 CDN。
2. **不碰业务逻辑**：`js/decoder.js`、`js/viewer.js`、`js/inspector.js`、`js/picker.js`、`js/main.js`、`js/i18n.js`、`lib/utif.js` 一律不改。
3. **CSS 只追加**：只能修改 `css/style.css` 的末尾——在新段落里加内容页排版样式，不得修改已有规则。改完 CSS 后，**所有** HTML 里的 `?v=1` 统一改成 `?v=2`（这是缓存失效机制，见 `deploy/CLOUDFLARE.md` 的「多语言」一节）。
4. **中文页用相对路径，英文页用根绝对路径**：中文页 `css/style.css?v=2`；英文页 `/css/style.css?v=2`。这与现有 `index.html` / `en/index.html` 保持一致。
5. **不引入新的第三方资源**：分享图统一复用 `/img/og-cover.png`。
6. **两页 DOM 结构保持一致**（中英对应页的 `id` 可以不同，但可见结构要一一对应）。
7. **全部文案要写实**：不许出现「在当今数字化时代」「无论你是新手还是专家」「总之」这类填充句。每段不超过 3 行。宁可写具体数字和具体操作，不要写形容词。
8. **不得虚构事实**：不确定的技术细节宁可不写，也不要编造 API 名、字段值、标准编号。

---

## 3. 要交付的页面

| # | 中文页 | 英文页 | 页面主题 | 主要目标关键词 |
|---|---|---|---|---|
| 1 | `guides/depth-tiff.html` | `en/guides/depth-tiff.html` | 16bit TIFF 深度图的查看与伪彩色 | 16位 tiff 深度图 / 16-bit tiff depth map viewer |
| 2 | `guides/color-picker.html` | `en/guides/color-picker.html` | 从图片取色，HEX/RGB 换算与陷阱 | 图片取色器 / image color picker hex |
| 3 | `guides/pixel-inspector.html` | `en/guides/pixel-inspector.html` | 像素坐标、放大镜与网格 | 图片像素查看器 / pixel inspector |
| 4 | `faq.html` | `en/faq.html` | 常见问题（结构化 FAQ） | — |
| 5 | `about.html` | `en/about.html` | 关于本站 | — |
| 6 | `privacy.html` | `en/privacy.html` | 隐私说明（AdSense 过审必需） | — |

URL 规则：

- 中文：`https://yangzixiong.com/guides/depth-tiff.html`
- 英文：`https://yangzixiong.com/en/guides/depth-tiff.html`

（保留 `.html` 后缀，与现有 `404.html` 一致，不使用目录式 URL。）

---

## 4. 每个页面必须有的 `<head>`

以中文 `guides/depth-tiff.html` 为例，`<head>` 必须包含以下内容，顺序不限但一项都不能少：

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>如何查看 16bit TIFF 深度图 · ImageLab</title>
<meta name="description" content="（中文 60–120 字，说明本文解决什么问题、读者读完能做什么）">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://yangzixiong.com/guides/depth-tiff.html">

<link rel="alternate" hreflang="zh-CN" href="https://yangzixiong.com/guides/depth-tiff.html">
<link rel="alternate" hreflang="en" href="https://yangzixiong.com/en/guides/depth-tiff.html">
<link rel="alternate" hreflang="x-default" href="https://yangzixiong.com/guides/depth-tiff.html">

<meta property="og:type" content="article">
<meta property="og:site_name" content="ImageLab">
<meta property="og:locale" content="zh_CN">
<meta property="og:url" content="（同 canonical）">
<meta property="og:title" content="（同 title）">
<meta property="og:description" content="（同 description）">
<meta property="og:image" content="https://yangzixiong.com/img/og-cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="（同 title）">
<meta name="twitter:description" content="（同 description）">
<meta name="twitter:image" content="https://yangzixiong.com/img/og-cover.png">

<link rel="icon" href="（同首页的 data URI）">
<link rel="stylesheet" href="css/style.css?v=2">
<meta name="theme-color" content="#0f1216">
```

外加一段 JSON-LD（见第 6 节各页要求）。

**长度要求**：

- `<title>`：中文 ≤ 30 字（含 `· ImageLab`），英文 ≤ 60 字符
- `description`：中文 60–120 字，英文 120–160 字符；要具体，不要只是重复标题

---

## 5. 页面骨架与样式

每个内容页都用下面这个骨架（保持与工具页同一视觉语言）：

```html
<body class="doc">

<header class="topbar doc-topbar">
  <a class="brand" href="/">ImageLab<span class="brand-sub">图片 · RGB · 深度</span></a>
  <nav class="doc-nav">…指南 / 常见问题 / 关于 / 隐私…</nav>
  <div class="topbar-right">
    <nav class="lang-switch" aria-label="语言">
      <span class="lang-on" aria-current="true">中文</span>
      <span class="lang-sep">|</span>
      <a href="/en/guides/depth-tiff.html" hreflang="en" lang="en" data-lang-switch="en">EN</a>
    </nav>
  </div>
</header>

<main class="doc-main">
  <nav class="breadcrumb" aria-label="面包屑">
    <a href="/">首页</a> / <a href="/guides/depth-tiff.html">16bit 深度图</a>
  </nav>

  <article class="prose">
    <h1>如何查看 16bit TIFF 深度图</h1>
    <p class="lede">（一句话说明这篇文章解决什么问题）</p>
    …正文…
    <div class="doc-cta">
      <a class="btn" href="/">打开 ImageLab 试一下</a>
    </div>
  </article>
</main>

<footer class="site-footer">
  <nav>…6 个页面链接 + 首页…</nav>
  <p>ImageLab · 全部处理在浏览器本地完成，图片不会上传</p>
</footer>

</body>
```

`styles.css` 末尾追加（只追加，不改已有规则），至少包含：

- `.doc` / `.doc-main`：内容页的滚动式布局（工具页 `body` 是 `overflow:hidden`，内容页必须是可滚动的普通文档流）
- `.doc-nav`：顶栏二级导航，窄屏可隐藏
- `.breadcrumb`
- `.prose`：正文排版——`max-width: 760px`、行高 1.75、段间距、`h2` 上间距、`ul/ol/table/pre/code` 样式、`a` 用 `--accent` 色
- `.prose table`：有边框的紧凑表格
- `.prose pre`：`--panel` 背景、可横向滚动
- `.lede`：导语，字号稍大、颜色 `--muted`
- `.doc-cta`
- `.site-footer`
- 移动端：`@media (max-width: 720px)` 下正文两侧留白、表格允许横向滚动

配色/间距一律用 `:root` 里已有的 CSS 变量（`--bg`、`--panel`、`--border`、`--text`、`--muted`、`--accent`、`--accent2`），不要引入新色值。

---

## 6. 各页内容大纲

> 中文页 800–1500 字，英文页 600–1000 words。**内容必须对称**：英文页不是逐字翻译，但信息点必须一一对应。
> 每页至少 1 个表格或有序列表，至少 1 个 `<code>` 片段，至少 3 处站内链接。

### 6.1 `guides/depth-tiff.html` — 16bit TIFF 深度图

目标读者：3D 扫描、机器视觉、机器人、AR 从业者，手上有一个"打开全是黑的"的 TIFF。

必须覆盖的小节：

1. **什么文件才算深度图**：单通道、每像素一个距离值；和普通照片（三通道颜色）的区别。说明为什么这类图直接打开会发灰/发黑。
2. **16bit 意味着什么**：取值范围 0–65535；若 1 单位 = 1mm，量程 65.5m；对比 8bit 只有 256 级，做毫米级测量会分层。
3. **TIFF 里决定"是不是深度图"的字段**：`BitsPerSample`=16、`SamplesPerPixel`=1、`SampleFormat`（1=无符号、2=有符号、3=浮点）、`PhotometricInterpretation`=1（BlackIsZero）。给一段 `tiffinfo` 或 `exiftool` 的输出示例作为代码块。
4. **单位约定（本站口径，必须写清）**：16bit 整数按毫米（mm）解析；32bit 浮点按米解析并 ×1000 转毫米；像素值 0 视为无效深度，显示为透明、不参与范围统计。并注明：不同设备厂商的 TIFF 可能不是这个约定，遇到数值离谱先怀疑单位。
5. **为什么要伪彩色**：16bit 灰度在 8bit 屏幕上会被压缩掉细节。给一个三行表格对比 Jet / Viridis / 灰度：Jet 对比强、边界清晰但会制造假边界（不适合做定量判断）；Viridis 感知均匀，适合读数与论文图；灰度适合打印和叠加到 RGB。
6. **操作步骤**：打开文件 → 悬停读坐标与 mm 值 → 切换 colormap → 放大看像素网格。每步一句话。
7. **排错清单**（用表格：现象 / 可能原因 / 处理）：整张黑、整张白、数值量级不对、打开失败、边缘有黑洞。
8. **本站不做什么**：不支持 BigTIFF、不支持多页/多通道、不做点云导出、不做距离测量标注。写明这些是刻意的取舍（保持零依赖、纯前端）。

JSON-LD：`Article`，字段含 `headline`、`description`、`inLanguage`、`datePublished`（2026-10-19）、`author`（`Organization`，name `ImageLab`）。

### 6.2 `guides/color-picker.html` — 图片取色

1. **为什么从截图取色经常取错**：浏览器缩放时的双线性插值、截图被 JPEG 二次压缩、显示器色彩管理（sRGB vs P3）、抗锯齿边缘。
2. **取到的是"哪个像素"**：原图像素 vs 显示像素的区别；为什么要在 100% 以上放大后取色。
3. **HEX / RGB / HSL 换算**：给出 `#4f8cff` ↔ `rgb(79, 140, 255)` 的对应，以及 HEX 三位简写规则、大小写无关。
4. **落地用法**：CSS 自定义属性写法（代码块）、和设计系统对接时的命名建议。
5. **对比度**：WCAG 正文 4.5:1、大字号 3:1；说明取到颜色后还要算对比度，不能只看好看。
6. **在 ImageLab 里的流程**：悬停读 HEX/RGB → 单击复制 → 历史记录点一下再复制。
7. **透明通道注意**：本站取的是显示出来的像素值，不做 alpha 感知；PNG 透明区域会显示为棋盘格背景色。

JSON-LD：`Article`。

### 6.3 `guides/pixel-inspector.html` — 像素坐标与放大镜

1. **图像坐标系**：原点在左上角 `(0,0)`，x 向右、y 向下；与数学坐标系相反，写清以免错位。
2. **三种像素**：图像像素、CSS 像素、设备像素（devicePixelRatio）。举一个 2× DPR 屏的例子说明为什么"看起来是 2 倍"。
3. **放大镜**：11×11 邻域、中心格描边；靠近图像边缘时如何补齐。
4. **像素网格**：缩放 ≥ 14× 才显示，避免低倍率下网格糊成一片。
5. **以鼠标为中心缩放**：说明缩放的锚点固定在光标位置，公式用一行代码示例表达。
6. **常见用途**：切图对位、像素画检查、sprite 边界、验证设计稿 1px 边框是否真的 1px。
7. **为什么直接用浏览器缩放看图不靠谱**：`image-rendering` 与平滑算法的差异。

JSON-LD：`Article`。

### 6.4 `faq.html` — 常见问题

必须有 10–12 条问答，每条用 `<h3>` + 段落（不要用折叠组件，保持可被爬虫读取）。至少覆盖：

1. 图片会上传到服务器吗？（不会，全部在浏览器本地处理）
2. 支持哪些格式？
3. 支持多大的图片？（取决于浏览器内存，说明没有人为限制）
4. TIFF 的哪些压缩格式支持？（LZW / Deflate / PackBits / 无压缩；JPEG-in-TIFF 不支持）
5. 深度值的单位是什么？
6. 为什么深度图打开是黑白的 / 全黑的？
7. 为什么取到的颜色和设计稿不一样？
8. 可以离线使用吗？
9. 会把我的图片存下来吗？（不存；只有语言偏好写 localStorage）
10. 免费吗？有广告吗？
11. 支持手机吗？
12. 发现 bug 怎么反馈？

JSON-LD 必须是 `FAQPage`，`mainEntity` 数组里为**每一条**问答生成 `Question` + `Answer`，文字与页面上完全一致。

### 6.5 `about.html` — 关于

- 为什么做这个工具（真实动机：现有在线工具要么上传图片、要么不支持 16bit TIFF）
- 技术实现：Canvas 2D、UTIF.js 解码 TIFF、无后端
- 谁做的、如何联系
- 明确声明：不收集图片、不注册即可用
- 后续计划（内容页、更多格式）

JSON-LD：`AboutPage`。

### 6.6 `privacy.html` — 隐私说明

AdSense 审核会看这一页，必须写实：

- 图片文件不离开浏览器（给出技术依据：`FileReader` / `createObjectURL`，无 `fetch`、无 `XMLHttpRequest`）
- 本地存储只用了一个 key：`imagelab.lang`（记录语言偏好），并说明如何清除
- 托管在 Cloudflare，会记录常规访问日志（IP、UA）用于安全和统计
- 若将来接入广告：Google 及其合作伙伴可能使用 Cookie，并给出 AdSense 隐私政策的链接位置（**现在没接入就不要说已经接入**）
- 联系方式
- 更新日期

JSON-LD：`WebPage`。

---

## 7. 站内导航改造

1. **每个内容页的 footer** 都包含同一组链接：首页、16bit 深度图、图片取色、像素查看、常见问题、关于、隐私，外加对应语言的另一版本链接。
2. **工具首页**（`index.html` 与 `en/index.html`）：在 `</main>` 之后、`<script>` 之前插入同样的 `<footer class="site-footer">`。**不要**往顶栏塞导航——顶栏已经很挤，加链接会挤坏布局。
3. **`404.html`**：加一行链接到 `/guides/depth-tiff.html`。
4. 内容页之间互链：每篇文章正文里至少 2 处指向另外两篇指南（自然措辞，比如"如果你只想确认某个像素的颜色，见《图片取色》"）。

---

## 8. `sitemap.xml`

改成 14 条 URL（2 个首页 + 12 个内容页），每条都带三条 `xhtml:link`（zh-CN / en / x-default 指向中文版）。

优先级建议：首页 `1.0`、三个 guides `0.8`、faq `0.7`、about/privacy `0.5`；英文版各降 0.1。

`lastmod` 统一写 `2026-10-19`。

---

## 9. 自检脚本 `deploy/check_content.py`

用 Python 3 标准库写（不要装第三方包），从仓库根目录运行 `python deploy/check_content.py`，逐项打印 `OK` / `FAIL`，**全部通过时退出码为 0**。

必须校验：

1. 12 个文件都存在
2. 每个文件 `<title>`、`meta description` 非空，且长度在要求范围内
3. 每个文件恰好 1 个 `<h1>`
4. `canonical` 是该页的绝对 URL（与文件路径推导出的 URL 完全一致）
5. 三条 `hreflang` 齐全，且中英互指正确
6. 每页的站内链接（`href="/..."` 或相对路径）指向的文件真实存在
7. 中英对应页的 `<h1>` 都不为空
8. `faq.html` 的 JSON-LD 是 `FAQPage`，且 `mainEntity` 条数 = 页面上 `<h3>` 条数
9. `sitemap.xml` 能被 `xml.etree.ElementTree` 解析，且包含 14 个 `<loc>`
10. `js/`、`lib/`、`css/` 下的文件在这次改动中没有被删除

README 里补一行这个脚本的用途。

---

## 10. 分批交付（每批独立可验收）

- **第 1 批**：`guides/depth-tiff.html` + 英文版 + `.prose` 等样式 + footer 组件样式 + `deploy/check_content.py` 骨架（先只校验这 2 个文件）
- **第 2 批**：另外两篇 guides（中英）
- **第 3 批**：`faq` / `about` / `privacy`（中英）+ 首页与 404 改造 + 完整 sitemap

每批完成后：跑 `python deploy/check_content.py`，把输出贴出来；每批单独 commit。

---

## 11. 禁止事项

- ❌ 不要改 `js/` 下任何文件，不要改 `lib/utif.js`
- ❌ 不要引入 Tailwind / Bootstrap / 任何 CDN 资源
- ❌ 不要用 `innerHTML` 拼接正文以外的动态内容；内容页是纯静态 HTML
- ❌ 不要用折叠面板（`<details>`）放 FAQ 正文——正文必须在 DOM 里直接可见
- ❌ 不要把文案写成营销腔（"强大""极致""一站式""赋能"）
- ❌ 不要编造不存在的功能（比如"支持点云导出""支持 BigTIFF""云端同步"）
- ❌ 不要修改 `_headers` 里已有的缓存规则
- ❌ 不要改 git 历史，不要 force push
- ❌ 不要在页面里写死未经核实的 API 名或标准编号

---

## 12. 完成判据

全部满足才算完成：

1. `python deploy/check_content.py` 退出码 0，所有项 `OK`
2. `python deploy/check_seo.py` 和 `python deploy/check_i18n.py` 仍然全部通过（不能破坏已有页面）
3. 12 个页面在本地 `python -m http.server` 下都能 200，无控制台报错
4. `grep -r "example.com" .` 无结果
5. 每个中文页的 `?v=` 已是 `2`，且 `css/style.css` 确实被改动过
6. git 上是 3 个新增提交（每批一个），未修改 `js/` 下任何文件的 diff
