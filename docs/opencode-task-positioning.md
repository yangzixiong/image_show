# 任务书：站点定位改为「AI 绘图 + 图片工具」并落地首页改版

> 配套文档：`docs/positioning-spec.md`（定位、URL 表、文案、SEO 规范）
> 执行者：opencode　｜　仓库：`D:\yzx_workspace\image_show`　｜　写法：静态站，无构建、无后端
> 分成 5 批，**每次只跑一批，跑完自检通过并 commit 后再跑下一批**。

---

## 0. 动手前必须知道的现状

- 已有 24 个 HTML：首页（中英）、3 篇教程（中英）、faq/about/privacy（中英）、5 个工具页（histogram / flip / crop / grid / remove-bg，中英）。
- 所有 HTML 引用 `css/style.css?v=4`，`js/*.js?v=4`。**改动 css/js 的批次要把版本号整体 +1**。
- 工具页 URL 已统一为无扩展名（`/tools/crop`），canonical 也已是无扩展名，**继续保持这个约定**。
- 工具页骨架：`body class="doc tool"` + `.topbar.doc-topbar` + `.tool-main` + `.tool-notes` + `.site-footer`，样式类都在 `css/style.css` 里，不要另起一套。
- 自检脚本三个，必须全绿：`deploy/check_content.py`、`deploy/check_i18n.py`、`deploy/check_seo.py`。
- `docs/` 在 `.assetsignore` 里，不会上线。

---

## 批 1：品牌基线与全局导航（只改 HTML 文案与少量资源）

**目标**：把"图片查看器"的口吻换成"工具箱"的口吻，全站一致。

1. **顶栏副标题**，24 个页面统一：
   - 中文页：`<span class="brand-sub">AI 绘图 · 图片工具</span>`
   - 英文页：`<span class="brand-sub">AI art · image tools</span>`
   - 现在英文页有两种写法（`Pixels · RGB · Depth` 与 `pixels · RGB · depth`），一并统一。
2. **顶栏导航**：把各页 `.doc-nav` 里的具体工具链接，统一换成四个首页锚点：
   ```html
   <nav class="doc-nav" aria-label="站内导航">
     <a href="/#inspect">查看</a>
     <a href="/#edit">编辑</a>
     <a href="/#prompt">提示词</a>
     <a href="/#guides">教程</a>
   </nav>
   ```
   英文页用 `Inspect` / `Edit` / `Prompts` / `Guides`，href 改 `/en/#inspect` 等。
   当前所在分类可加 `aria-current="page"`。
3. **页脚**：改成三组 + 教程 + 站点信息的分栏结构，每组一个 `h3`（或 `<strong>`）。中文页：
   - 查看与分析：像素与深度查看器、图片直方图
   - 编辑与导出：图片裁剪、翻转旋转、九宫格分割、一键抠图
   - AI 提示词：权重计算器、正反词分离、负面词库、随机生成、提示词翻译、Token 计数器
   - 教程：16bit TIFF、图片取色、像素查看
   - 站点：常见问题、关于、隐私、English version
   英文页对应英文标签，路径加 `/en` 前缀。**此时这些链接指向的页面有的还不存在，先照写**（批 3、批 4 会把页面补齐；`check_content.py` 的 `PLANNED_URLS` 里要先登记，避免自检报红）。
4. **favicon 统一**：`crop.html` / `grid.html` / `remove-bg.html` 的内联 SVG 用的是 `%232f6bdb`，改成和其他页一致的 `%234f8cff`。
5. **`site.webmanifest`**：
   ```json
   "name": "ImageLab · AI 绘图与图片处理工具箱",
   "short_name": "ImageLab",
   "description": "十二个浏览器工具：像素与深度查看、图片编辑导出、Stable Diffusion 提示词处理。全部本地运行，文件不上传。"
   ```
6. **`deploy/make_og_image.py`**：把分享图上的副标题改成 `AI 绘图 · 图片工具`，功能行改成 `图片像素 · 直方图 · 裁剪抠图 · AI 提示词`，重新生成 `img/og-cover.png`（1200×630）。跑法见文件头注释。
7. **`README.md`**：把开头一句话介绍改成新定位，目录结构补 `docs/positioning-spec.md`。

**验收**：`python deploy/check_seo.py` 通过；`python deploy/check_i18n.py` 通过（新页还没建，只查现有）。
**commit**：`chore(brand): reposition site as AI art & image toolkit, unify brand nav`

---

## 批 2：首页改成目录页 + 查看器迁移（本批最关键）

**目标**：`/` 变成工具箱目录（可滚动长页），查看器搬到 `/tools/pixel-viewer`。

### 2.1 迁移查看器

1. `git mv index.html tools/pixel-viewer.html`，`git mv en/index.html en/tools/pixel-viewer.html`。
2. 在新文件里改 head：
   - `<title>16bit TIFF 深度图与像素查看器 · ImageLab</title>` / `16-bit TIFF Depth Map & Pixel Viewer | ImageLab`
   - canonical → `https://yangzixiong.com/tools/pixel-viewer`（中）、`.../en/tools/pixel-viewer`（英）
   - hreflang 三条互指新 URL
   - `og:url` 同步；`og:title`/`description` 跟 title 走
   - JSON-LD 的 `url` 改成新地址
   - 顶栏换成批 1 的四个锚点 + 加一条「← 全部工具」链到 `/`
3. **body 结构与所有 id 保持原样**，脚本加载顺序不变。`js/main.js`、`viewer.js`、`inspector.js`、`picker.js` 一个字都不要改。

### 2.2 新首页（`/` 与 `/en/`）

结构照 `docs/positioning-spec.md` 第 4 节。硬性要求：

- **恰好 1 个 `h1`**：`AI 绘图与图片处理工具箱` / `AI art & image tools, all in your browser`
- 首屏最显眼处一个主按钮：`打开查看器` → `/tools/pixel-viewer`（这是老访客的落点，必须有）
- 四个区块带 id，供顶栏锚点跳转：`#inspect`、`#edit`、`#prompt`、`#guides`
- 每区块：`h2` + 一段 60–120 字说明 + 卡片网格。卡片 = 工具名（链接）+ 一行说明（12–20 字）+ 标签
- 标签只用这三种：`本地`、`16bit TIFF`、`首次需下载模型`
- 正文总字数 ≥ 350 字（中文），英文 ≥ 300 words，内容是"这些工具回答什么问题、为什么要本地跑"
- 「为什么都在本地跑」三条，见定位文档
- 页脚同批 1
- JSON-LD：`CollectionPage` + `ItemList`，`itemListElement` 列出全部工具（`name` + `url`）
- 保留顶部横幅广告位注释（`<div class="ad-slot ad-top">`），放在首屏按钮下方

**新增样式**：首页卡片网格需要 `.tool-grid-cards`、`.tool-card`、`.tool-card .tag`、`.hero`、`.hero-cta`、`.why-local` 等，追加到 `css/style.css` 末尾（不要改动已有规则）。同时把全站 `?v=4` → `?v=5`。

### 2.3 同步改动

- `sitemap.xml`：`/` 与 `/en/` 保留（现在是目录页），**新增** `/tools/pixel-viewer` 与 `/en/tools/pixel-viewer`（共 26 条）
- `deploy/check_seo.py`：现在它写死了检查 `<h1 class="sr-only">` 和 `featureList`，首页改版后不成立。改成：`index.html` 必须有且仅有一个 `<h1>`、有 canonical、JSON-LD 可解析且 `@type` 是 `CollectionPage`；`featureList` 的检查移到 `tools/pixel-viewer.html`。
- `deploy/check_content.py`：`PAGES` 增加 pixel-viewer 中英两条，`EXPECTED_SITEMAP = 26`，`PLANNED_URLS` 补上所有还没建的工具 URL。

**验收**：
```
python deploy/check_content.py && python deploy/check_i18n.py && python deploy/check_seo.py
```
外加本地起 `python -m http.server 8000`，确认 `/` 能滚动、四个锚点能跳、`/tools/pixel-viewer` 拖图后像素信息面板正常（id 没被改坏）。

**commit**：`feat(home): turn landing page into a toolkit directory, move viewer to /tools/pixel-viewer`

---

## 批 3：提示词工具第一组（权重 / 正反词 / 负面词库）

**目标**：三个纯逻辑工具，中英各一，一共 6 个页面。

### 3.1 先建共用解析器 `js/promptlib.js`

全局对象 `PromptLib`，暴露四个方法（写 JSDoc，别写 TS）：

```js
// 解析带权重的提示词，返回 { items: [{text, weight, from, to, depth}], errors: [{from, to, message}] }
PromptLib.parseWeighted(text, { dialect: "a1111" | "comfyui" })

// 拆分正反词，返回 { positive, negative, unknown, detected: "labeled" | "separator" | "blankline" | "none" }
PromptLib.splitPositiveNegative(text)

// 拼负面词，入参是已选词条的 id 数组 + 自定义词，返回一行可直接粘贴的字符串
PromptLib.buildNegative(selectedIds, customText, lib)

// 分词（CLIP BPE 的近似实现，用于 token-counter 与权重预览）
PromptLib.countTokens(text, { vocab: "clip" | "cl100k" | "o200k", table: <可选，传入已加载的词表> })
```

要点：
- 支持 `(word)`（A1111 为 ×1.1，ComfyUI 为 ×1.0）、`[word]`（÷1.1）、`(word:1.3)`、`{word}`（×1.05）、嵌套相乘、`\(` `\[` 转义、`BREAK`、`AND`；ComfyUI 额外支持 `[a|b]`、`{a|b|c}`，解析结果里标 `alternation: true`。
- 语法错误（括号不配对、权重不是数字、嵌套过深 >8 层）要返回位置，页面高亮对应片段，**不要 throw**。
- `countTokens` 只做近似：没有词表时退化为「按 CLIP BPE 的合并规则粗估」，有词表时精确。词表加载由调用方负责。

### 3.2 三个工具页

| 页面 | 交互要求 |
|---|---|
| `/tools/prompt-weight` | 左：`textarea` 输入提示词；右：逐项权重色带（`≤0.5` 灰蓝、`0.5–0.9` 蓝、`1.0` 白、`1.1–1.5` 橙、`>1.5` 红），鼠标悬停高亮原文对应片段；顶部一个 `A1111 / ComfyUI` 切换；底部实时显示「总 token 数」与语法错误列表；「载入示例」按钮给一段含嵌套和错误的真实提示词 |
| `/tools/prompt-split` | 一个输入框 + 两个输出框（Positive / Negative）+ 两条「复制」；自动识别 `Positive:`/`Negative:`、`###`、空行、`--no`、JSON（`{"prompt": "...", "negative_prompt": "..."}`）；识别不出时给一句提示并整段放进 Positive |
| `/tools/negative-prompt` | 左侧按四组勾选（通用质量 / 写实 / 二次元 / SDXL 手部与解剖），右侧实时预览拼好的字符串 + 复制；支持「只复制负面」「复制完整正负一对」；词条数据放 `data/negative-prompts.json` |

数据文件格式（提示词工具通用）：
```json
{ "groups": [ { "id": "quality", "label": { "zh": "通用质量", "en": "General quality" },
  "items": [ { "id": "q1", "text": "lowres", "label": { "zh": "低分辨率", "en": "low resolution" } } ] } ] }
```
所有文案字段都写 `{zh, en}` 两份，页面按 `<html lang>` 取。

每页正文：`section.tool-notes` 三小节，每节 120–200 字，讲清"这个工具解决什么、语法差异在哪、常见错误"。英文页对应。

**验收**：三个脚本全绿；`node --check js/promptlib.js`；手工打开三页各试一遍示例与错误输入。
**commit**：`feat(prompts): weight parser, prompt splitter and negative prompt builder (zh/en)`

---

## 批 4：提示词工具第二组（随机 / 翻译 / Token）

| 页面 | 交互要求 | 数据 |
|---|---|---|
| `/tools/random-prompt` | 按「画质 / 主体 / 动作 / 场景 / 光照 / 镜头」六层随机；可锁定某层不换；`?seed=123` 可复现并支持「复制分享链接」；可切换「标签流（逗号）」与「自然语言」两种输出 | `data/random-prompts.json`，每层 20–40 条，带权重 |
| `/tools/prompt-translate` | 中文输入 → 英文标签串；反向也支持；未命中的词单独列在「未收录」区，提示可补充 | `data/prompt-terms.json`：词条 + 同义词 + 固定写法（`1girl` 不能翻成 one girl） |
| `/tools/token-counter` | 选择模型：CLIP（77/段，标出第几段被截断）、T5-XXL（SD3，512）、o200k_base、cl100k_base；显示总 token、分段、剩余额度；词表**只在打开本页时** `fetch` 并缓存 | `data/tok/` 下放词表；>5 MB 的先不上，页面里注明"暂未支持" |

**硬性约束**：
- 所有第三方词表 vendor 到仓库，**禁止 CDN**。许可证记到 `README.md`（现有 `lib/fflate.js`、`lib/ort/` 已有先例）。
- 词表文件必须按需加载，不能进首屏（首页 LCP 不能被拖慢）。
- 随机生成器与翻译器都要能纯离线工作（断网打开仍可用）。

**验收**：三个脚本全绿，`EXPECTED_SITEMAP = 38`；断网状态下打开随机生成器与翻译器确认可用。
**commit**：`feat(prompts): random generator, term translator and token counter (zh/en)`

---

## 批 5：收口

1. `sitemap.xml` 38 条，核对每个 `<loc>` 都能打开、都无 `.html` 后缀。
2. `deploy/check_content.py`：`PAGES` 12 个工具页 × 2、`PLANNED_URLS` 清空（全部已交付）、`EXPECTED_SITEMAP = 38`。
3. `README.md`：目录结构、工具清单表、新增第三方库与许可证、`?v=` 当前值。
4. `robots.txt` 不变；`404.html` 里加两个「热门工具」链接。
5. 全站 grep 一遍：不应再有 `图片 · RGB · 深度`、`Pixels · RGB · Depth`、`?v=4`。

**commit**：`chore: finish toolkit repositioning, 38 sitemap URLs and updated checks`

---

## 禁止清单

- ❌ 不引入构建步骤、不新增运行时 npm 依赖、不引 CDN
- ❌ 不改 `js/main.js`、`js/viewer.js`、`js/inspector.js`、`js/picker.js` 的 DOM id 约定（迁移查看器时尤其注意）
- ❌ 不虚构功能：没做的模型、没测过的格式不要写进页面
- ❌ 不用 `<details>` 做折叠（防爬），正文要直接可见
- ❌ 不为凑字数堆关键词，正文必须是真实说明
- ❌ 不一次跑完 5 批，每批各自 commit

## 参考：现有可用能力（不要重复造）

- `js/toolkit.js`：选文件、拖放、Ctrl+V、下载、体积格式化、toast
- `js/decoder.js`：JPG/PNG/WebP/GIF/BMP/TIFF 解码，16bit 深度图转伪彩色
- `lib/utif.js`（TIFF）、`lib/fflate.js`（zip）、`lib/ort/`（onnxruntime-web，抠图用）
- `css/style.css` 里的 `.tool-main` `.dropzone` `.tool-grid` `.tool-side` `.tool-notes` `.related` 等工具页骨架
