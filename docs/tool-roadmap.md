# 新增工具排期（按现有代码适配）

> 写于 2026-10-20，先读了仓库当前实现再排期。
> 当前状态：commit `1b59d8a`，38 条 sitemap URL，12 个工具（中英 24 页）+ 2 个首页 + 6 个内容页 + 404。
> 定位改版 5 批已全部合入，本文在此基础上排下一轮。

---

## 0. 读代码得到的硬约束（排期必须遵守）

### 0.1 一个工具页由 4 个文件组成

以裁剪工具为例（`tools/crop.html` / `tools/crop.js` / `en/tools/crop.html` / `en/tools/crop.js`）：

| 层 | 位置 | 说明 |
|---|---|---|
| 页面 | `tools/<name>.html`（229 行左右） | head（title/desc/canonical/hreflang/og/JSON-LD）+ 骨架 + 正文三段 + 页脚 |
| 逻辑 | `tools/<name>.js` | IIFE，`DOMContentLoaded` 里取 `els` |
| 英文页 | `en/tools/<name>.html` | 同一份 JS，`<html lang="en">` 驱动文案 |
| 导航 | 39 个 HTML 的 `doc-nav` + 页脚 | 新增分类要改全部 |

页面骨架是固定的（`tools/crop.html:72`）：`<body class="doc tool">` → `.topbar.doc-topbar` → `main.tool-main`（`.tool-head` h1 + `.tool-sub` → `.dropzone` → `.tool-grid` + `.tool-side` → `.tool-notes` 三段 → `.related` → `.tool-back`）→ `.site-footer`（五组）→ `#toast`。

### 0.2 文案约定：工具 JS 用**本地 DICT**，不要用全局 `t()`

`tools/crop.js:11-39` 是当前标准写法：

```js
var DICT = { zh: {...}, en: {...} };
function tt(key, vars) { var lang = document.documentElement.lang === "en" ? "en" : "zh"; ... }
```

**注意**：`histogram.js`、`flip.js` 还在用全局 `t()`（`js/i18n.js` 里那套），是从上一版遗留的。新工具一律照 `crop.js` 写，别引新债。

### 0.3 可复用的东西（不要重写）

| 能力 | 位置 | 接口 |
|---|---|---|
| 选文件/拖放/Ctrl+V | `js/toolkit.js:20` | `Toolkit.bindDrop(zone, input, onFile)` |
| 下载 | `js/toolkit.js:47` | `Toolkit.download(blob, filename)`（5 秒后 revoke） |
| 体积/文件名/toast | `js/toolkit.js:59-77` | `fmtBytes` / `baseName` / `toast` |
| 图片解码 | `js/decoder.js` | `Decoder.decode(file)` → `{width,height,kind,rgba,canvas,depth,dmin,dmax}` |
| 16bit TIFF | 同上，`kind === "depth"` | 已处理 BitsPerSample / SampleFormat / colormap |
| zip 打包 | `lib/fflate.js` | `fflate.zipSync(files, {level: 0})`，用法见 `tools/grid.js:161` |
| JSON 数据按需加载 | `tools/negative-prompt.js:77` | `fetch("/data/xxx.json")` |

### 0.4 三个校验脚本必须全绿

| 脚本 | 新增工具时要改什么 |
|---|---|
| `deploy/check_content.py:22` | `PAGES` 加中英两条 |
| 同上 `:65` | `EXPECTED_SITEMAP` +N |
| 同上 `:68` | `EXPECTED_ASSETS` 加新 js / data 文件 |
| 同上 `:160`、`:214` | 改 `css/style.css` 时，把 `?v=5` 改新版本号 |
| `deploy/check_seo.py:46` | 首页 ItemList 要 ≥12 条（只增不减，不用改） |
| `deploy/check_i18n.py:10` | 只比对中英首页的 id 集合，工具页不受影响 |

### 0.5 版本号约定是**逐文件**的，不是全站统一

现在：`style.css?v=5`、`i18n.js/decoder.js/toolkit.js?v=3`、`promptlib.js?v=2`、各工具 js `?v=1`。
**改哪个 bump 哪个**。只有改 `style.css` 才会触发全站升级（39 个文件 + 校验脚本两处）。

### 0.6 移动端顶栏是隐藏的

`css/style.css:309`：`@media (max-width:720px) { .doc-nav { display:none } }`。所以顶栏加到 6 个入口不会挤爆手机——但也要注意，手机用户只能靠首页卡片和页脚导航。

### 0.7 页脚是 39 份复制粘贴

加一组分类 = 改 39 个 HTML。必须写一次性脚本批量插入（参考已被删掉的 `deploy/_migrate_tools.mjs` 做法），跑完删除脚本。

### 0.8 顺手要修的现有不一致

| 问题 | 现状 | 修法 |
|---|---|---|
| favicon 颜色两套 | `index.html:31`、`crop.html:29` 等仍是 `%232f6bdb` | 统一 `%234f8cff` |
| `theme-color` 两套 | `index.html:34` 是 `#ffffff`，其他页 `#0f1216` | 统一 `#ffffff`（站点是浅色主题，`--bg: #ffffff`） |
| 旧 `t()` 写法 | `histogram.js`（12 处）、`flip.js`（6 处） | 迁到本地 DICT（可延后，不影响新工具） |
| 两份文档未提交 | `docs/positioning-spec.md`、`docs/opencode-task-positioning.md` 还是 untracked | 先 commit |

---

## 1. 批次总览

| 批 | 主题 | 新增页面 | 新数据文件 | sitemap | 主要复用 | 估时 |
|---|---|---|---|---|---|---|
| 0 | 清理与准备 | 0 | 0 | 38 | — | 30 分钟 |
| 1 | 视频（帧提取 + 分镜计时） | 4 | 0 | **42** | `fflate`、`decoder` | 半天 |
| 2 | ComfyUI 工作流校验 | 2 | 1（节点清单） | **44** | 纯 JS | 1 天 |
| 3 | 色彩三件套 | 6 | 0 | **50** | `decoder` | 半天 |
| 4 | 收口（哈希可选） | 0–2 | 0 | 50–52 | `crypto.subtle` | 半天 |

顺序理由：**先做不需要新数据的**（视频批），再做需要维护数据文件的（ComfyUI 节点清单），色彩批虽然简单但页面数最多放后面，哈希有技术坑放最后且标可选。

---

## 批 0：清理与准备（不改功能）

1. `git add docs/ && git commit` —— 两份定位文档入库。
2. favicon 统一：`grep -rl "%232f6bdb" *.html en/*.html tools/*.html en/tools/*.html guides/*.html en/guides/*.html` 全部替换成 `%234f8cff`。
3. `theme-color` 统一为 `#0f1216`。
4. 跑三个 check 脚本确认仍全绿。

**commit**：`chore: commit positioning docs, unify favicon color and theme-color`

---

## 批 1：视频工具（新增「视频」分类）

### 1.1 页面

| 页面 | URL | 中文 title（≤30 字） | 英文 title（≤60 字符） |
|---|---|---|---|
| 视频帧提取 | `/tools/video-frame` | `视频帧提取 · 本地截帧不上传` | `Extract Frames From Video in Your Browser` |
| 分镜计时器 | `/tools/storyboard-timer` | `短视频分镜计时器 · 15/30 秒` | `Short Video Storyboard Timer — 15s & 30s` |

### 1.2 视频帧提取的技术要点

- 解码链：`File` → `URL.createObjectURL` → `<video>`（`preload="metadata"`）→ 设 `currentTime` → 等 `seeked` → `canvas.drawImage(video)`。
- **精度**：优先用 `video.requestVideoFrameCallback` 取 `mediaTime`，没有就退回 `seeked` + 一次 `requestAnimationFrame`。别用 `setTimeout` 估时间。
- 支持三种输入：单个时间点、时间点列表（`1s, 2.5s, 50%`）、按间隔（每 0.5s / 每 N 帧）。
- 多帧导出走 `fflate.zipSync(files, {level: 0})`（PNG 已压缩，level 0 只做容器），单帧直接 `Toolkit.download`。
- **内存**：逐帧 `canvas.toBlob` 后立刻释放 canvas 与 ImageData，绝不把整段视频的帧都存在内存里。
- **兼容性提示要写在页面上**：Chrome/Edge 不解码 HEVC（H.265）——用 `video.canPlayType('video/mp4; codecs="hvc1"')` 判断后明确告诉用户"这个编码浏览器解不了，请先转成 H.264"。
- 风险：4K 长视频随机 seek 很慢。默认策略给"按顺序播放式提取"（边播边抽帧），比逐个 seek 快数倍。

### 1.3 分镜计时器的技术要点

纯 UI，零依赖：总时长（15/30/自定义）+ 分镜行（时长 + 画面描述）→ 播放时高亮当前镜 + 到点用 `OscillatorNode` 蜂鸣（不需要音频文件）+ 导出 CSV/纯文本分镜表。

### 1.4 本批要改的既有文件

- `css/style.css`：加 `.video-stage`、`.timeline`、`.frame-list`、`.thumb-grid` 等，**然后全站 `?v=5` → `?v=6`**，同时改 `deploy/check_content.py:160` 和 `:214`。
- `index.html` + `en/index.html`：新增 `<section id="video">`，里面两张卡片；JSON-LD `numberOfItems` 12 → **14**，`itemListElement` 加两条。
- 39 个 HTML 的 `doc-nav`：改成 6 个入口 `查看 · 编辑 · 提示词 · 视频 · ComfyUI 教程` 时注意——ComfyUI 批 2 才上线，本批先加「视频」，批 2 再加「ComfyUI」，一次只加一个。
- 39 个 HTML 的页脚：新增「视频」分组（两个链接），脚本批量插入。
- `sitemap.xml`：38 → **42**。
- `deploy/check_content.py`：`PAGES` +4、`EXPECTED_SITEMAP = 42`、`EXPECTED_ASSETS` + `tools/video-frame.js`、`tools/storyboard-timer.js`。

**验收**：三个脚本全绿；`node --check` 两个新 js；浏览器拖一个 mp4 抽 3 帧并下载 zip；手机尺寸下时间轴不溢出。

---

## 批 2：ComfyUI 工作流校验（新增「ComfyUI」分类）

### 2.1 页面

| URL | 中文 title | 英文 title |
|---|---|---|
| `/tools/comfyui-check` | `ComfyUI 工作流校验与格式化` | `ComfyUI Workflow Validator & Formatter` |

单页，左输入右输出，不做两个页面（格式化和校验共享同一个解析器，拆开反而重复）。

### 2.2 必须同时认两种格式

| 格式 | 特征 | 来源 |
|---|---|---|
| 前端 workflow | 顶层有 `nodes` / `links` / `groups` | 「保存(Save)」按钮导出的 `.json` |
| API prompt | `{id: {class_type, inputs}}` 的扁平表 | 「导出 API 格式」或 `/prompt` 接口 |

格式识别：`json.nodes && Array.isArray(json.links)` → workflow；顶层每个值有 `class_type` → API。

### 2.3 校验项（这是与"普通 JSON 格式化"的唯一区别）

1. `links` 每条是 6 元组 `[link_id, from_node, from_slot, to_node, to_slot, type]`，`from_node` / `to_node` 必须存在于 `nodes`。
2. 每个节点的 `inputs[].link` 必须在 `links` 里能找到对应 id（找不到 = 悬空输入）。
3. 有节点 id 重复。
4. `widgets_values` 长度与节点类型的预期参数个数不符 → 只**警告**，不下结论（不同版本会变）。
5. `class_type` / `type` 不在内置清单里 → 列为"可能是缺失的自定义节点"，措辞必须留余地。
6. 输出可复制：格式化（2 空格）、压缩（minify）、校验报告（纯文本）。

### 2.4 节点清单数据

`data/comfyui-nodes.json`：

```json
{ "version": "0.3.x", "generated": "2026-10-20", "core": ["KSampler", "CheckpointLoaderSimple", ...] }
```

- 首版手工整理 150–250 个常用节点（core + comfy_extras 高频项），文件里写清版本。
- 不联网抓取、不引用 ComfyUI 源码（许可证与体积都不合适）。
- 页面提供"导入你自己的 `/object_info` JSON 来补全清单"（存 localStorage），并在 UI 注明清单版本，避免用户以为漏报就是错。

**风险**：清单永远不全。所以第 5 条的措辞必须是「未在清单中，可能是自定义节点」而不是「缺少节点」。

### 2.5 本批要改的既有文件

同批 1 的清单：首页 section `#comfyui`（+ `numberOfItems` 16）、导航加「ComfyUI」、页脚加组、sitemap **44**、`check_content.py`（PAGES +2、EXPECTED_SITEMAP、EXPECTED_ASSETS 加 `data/comfyui-nodes.json` 与 `tools/comfyui-check.js`）。样式若不改 `style.css` 就不用升 `?v=`。

**验收**：拿一个真实的 SD 工作流（含 ControlNet + 一个自定义节点）跑一遍，确认能报出缺失节点；再拿 API 格式跑一遍。

---

## 批 3：色彩三件套

| URL | 中文 title | 英文 title | 复用 |
|---|---|---|---|
| `/tools/palette` | `图片色卡生成器 · 提取配色` | `Color Palette Generator From Image` | `Decoder.decode` |
| `/tools/contrast` | `颜色对比度检测 · WCAG` | `WCAG Color Contrast Checker` | 纯计算 |
| `/tools/gradient` | `CSS 渐变生成器` | `CSS Gradient Generator` | 纯计算 |

要点：

- **色卡**：缩到 ≤120px → sRGB 转 **OKLab** 再 k-means（k=3–8），不要在 RGB 里聚类（出来的颜色发灰）。输出 HEX / RGB / OKLCH + 一键复制 CSS 变量。加"按面积排序"和"合并相近色"阈值，否则低饱和图会出四团差不多的灰。
- **对比度**：WCAG 2.1 相对亮度公式，AA 4.5 / AAA 7 / 大字 3.0；额外给"当前前景色最接近的合格色"建议（沿 OKLCH 亮度轴调整）。
- **渐变**：linear / radial / conic + 多色标 + 角度，直接输出 CSS，附 3 个预设。
- 这三页归入**已有的「编辑与导出」**分类，不新增分类，导航不再变。
- 首页 `numberOfItems` 16 → **22**（或按实际卡片数），sitemap **50**。

---

## 批 4：收口（哈希工具可选）

**`/tools/file-hash` 的真实难点**，先说清楚：

- `crypto.subtle.digest()` **不支持增量**，只能一次吃完整块 `BufferSource`。1 GB 文件直接 `arrayBuffer()` 会顶到内存上限，而且中途无法显示进度。
- 要做"本地校验大文件"，只能①自己实现增量 SHA-256（纯 JS 约 150 行，100–300 MB/s，够用）②或者限制在 200 MB 以内并明确写在页面上。
- MD5 必须自实现（WebCrypto 没有）。

**建议**：这一批可以不排。它的搜索词全是红海（`file hash online` 第一页被老站占满），唯一的差异点是"不上传"，但目标用户（校验模型文件）本来就会用本地命令行，转化率存疑。

批 4 只做收口：
1. 全站 grep 确认无 `%232f6bdb`、无 `?v=5`、无旧 `t(` 调用残留。
2. `README.md` 工具表更新到 18 个。
3. `deploy/check_content.py` 注释更新（PAGES 数量、sitemap 数）。
4. `npx wrangler deploy` 后线上抽查 3 个新页。

---

## 每批固定动作清单（贴进任务书）

1. 写 `tools/<name>.html` + `.js`，复制 `en/` 一份，改 title/desc/canonical/hreflang/og/JSON-LD/正文
2. 页面专属样式优先写在页内 `<style>`（`crop.html:33-55` 的做法），避免动全局 `style.css`
3. 首页两个语言各加卡片 + section（若开新分类）+ JSON-LD `numberOfItems`
4. 页脚 + 导航：写一次性脚本批量改，跑完删
5. `sitemap.xml` 加 URL（工具页 priority 0.9）
6. `check_content.py` 三个变量同步
7. `python deploy/check_content.py && python deploy/check_i18n.py && python deploy/check_seo.py`
8. `node --check tools/<name>.js`
9. 浏览器验收 → `npx wrangler deploy` → 线上再验一次

**禁止**：不改 `js/main.js` 与查看器的 id；不引 CDN；不新增构建步骤；不虚构功能截图；不一次跑两批。

---

## 明确不做的

- 采样器参数模拟器、ControlNet 权重预览 —— 纯前端无法真实计算，只能造假
- Base64 / URL 编码 / JSON 格式化 / 时间戳 —— 红海且与定位冲突
- 任何需要后端的工具
