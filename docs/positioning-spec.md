# ImageLab 站点定位与内容架构

> 决策日期：2026-10-20　｜　适用仓库：`D:\yzx_workspace\image_show`
> 本文是「为什么这样定位 + 页面应该长什么样」，具体改代码的任务书见 `docs/opencode-task-positioning.md`。
> `docs/` 已在 `.assetsignore` 里，不会被打包上线。

---

## 1. 定位结论

**一句话定位**

- 中文：**ImageLab —— 为 AI 绘图与图片处理准备的浏览器工具，图片和提示词都不上传。**
- English：**ImageLab — browser tools for AI art and image work. Nothing is uploaded.**

**品牌副标题（顶栏 `brand-sub`，全站统一）**

- 中文：`AI 绘图 · 图片工具`
- English：`AI art · image tools`

**为什么不是「工具大全」**

1. 「在线工具箱」「工具大全」这类词是头部词，被 tool.lu、站长工具、菜鸟工具等十几年的老站占满，一个新域名（2026-10 上线、无外链）在这个词上**没有任何胜算**，投进去的页面只会成为无人访问的孤岛。
2. 「大全」意味着要有几百个工具才撑得起这个词，我们现在是 12 个。词和内容对不上，用户点进来就跳出，跳出率会反噬排名。
3. 工具箱类站点真正吃到流量的是**单个工具的搜索词**（"negative prompt builder"、"16bit tiff viewer"），不是"工具箱"这三个字。所以定位要服务的是「每个工具页各自打赢一个长尾词」，而不是首页抢一个头部词。

**为什么选「AI 绘图 + 图片」这个垂直**

1. 现有工具天然分成两簇：图片像素/深度/直方图（技术深度是我们的差异化），加上提示词六件套（搜索量最大的一簇）。这两簇共同的服务对象就是同一批人：**在做 AI 绘图、或者要检查生成图的人**。
2. 这个组合有一个别人很难抄的差异点：**全程本地运行**。提示词工具尤其吃这个点——用户不愿把自己的商业提示词贴到一个陌生服务器上。
3. 英文侧的搜索量在这个交叉点上最大：`stable diffusion prompt tools`、`ai art prompt generator`、`tiff depth map viewer` 都是持续有量的长尾。

**三层关键词，分别由谁承接**

| 层级 | 例子 | 承接页面 | 预期 |
|---|---|---|---|
| 头部 | 在线工具箱、图片处理工具 | 首页 | 不指望排上去，只求品牌词和长尾词有归处 |
| 腰部 | AI 绘图工具箱、提示词工具、stable diffusion tools | 首页 + `/guides/` 教程 | 半年内进前 3 页 |
| 长尾（主战场） | prompt weight calculator、negative prompt builder、split positive negative prompt、16bit tiff depth map viewer、prompt token counter | **每个工具页各打一个** | 逐页进前 10，这是全部流量的来源 |

---

## 2. 不做什么

明确写下来，防止范围膨胀：

- **不做账号体系**。没有登录就没有"我的工具""历史记录"，也不需要隐私政策之外的合规投入。
- **不做需要后端的工具**（在线转码队列、批量处理服务端渲染、AI 生图）。一旦要后端，本地运行这个差异点就没了。
- **不做「同类工具导航」**（收集别人的工具链接）。那是目录站玩法，会把我们自己的页面稀释掉。
- **不追热点词**（Sora、可灵这类）。工具页的生命周期比模型热搜长得多。
- **首页不堆砌关键词**。正文 300–500 字，把"能干什么、为什么不上传"说清楚即可。

---

## 3. 信息架构

最终 **38 条 URL**（含中英各一份）。工具页统一放 `/tools/<name>`，**URL 不带 `.html`**（Cloudflare 的 `html_handling: auto-trailing-slash` 会把 `/tools/crop.html` 跳转到 `/tools/crop`，canonical 必须写不带后缀的那个，否则会被判成重复内容）。

### 3.1 顶层

| URL | 页面 | 说明 |
|---|---|---|
| `/` · `/en/` | **工具箱首页（新）** | 分类卡片 + 定位文案，可滚动长页 |
| `/tools/pixel-viewer` · `/en/tools/pixel-viewer` | 像素与深度查看器（**由现在的 `/` 迁移过来**） | 主工具，原先占用首页 |
| `/faq` `/about` `/privacy` + en | 已有 | 页脚入口 |
| `/guides/depth-tiff` `/guides/color-picker` `/guides/pixel-inspector` + en | 已有 | 教程，与工具页互链 |

### 3.2 工具清单（12 个 × 2 语言 = 24 页）

**A. 查看与分析 / Inspect & analyse**

| URL | 中文名 | 英文名 |
|---|---|---|
| `/tools/pixel-viewer` | 像素与深度查看器 | Pixel & Depth Viewer |
| `/tools/histogram` | 图片直方图查看器 | Image Histogram Viewer |

**B. 编辑与导出 / Edit & export**

| URL | 中文名 | 英文名 |
|---|---|---|
| `/tools/crop` | 图片裁剪 | Image Cropper |
| `/tools/flip` | 翻转旋转镜像 | Flip & Rotate |
| `/tools/grid` | 九宫格分割 | Grid Splitter |
| `/tools/remove-bg` | 一键抠图 | Background Remover |

**C. AI 提示词 / AI prompts（待建）**

| URL | 中文名 | 英文名 |
|---|---|---|
| `/tools/prompt-weight` | 提示词权重计算器 | Prompt Weight Calculator |
| `/tools/prompt-split` | 正反词分离工具 | Prompt Splitter |
| `/tools/negative-prompt` | 负面提示词库 | Negative Prompt Builder |
| `/tools/random-prompt` | 随机提示词生成器 | Random Prompt Generator |
| `/tools/prompt-translate` | 提示词翻译 | Prompt Translator |
| `/tools/token-counter` | Token 计数器 | Token Counter |

### 3.3 顶栏导航（全站统一，只放 4 个入口）

```
ImageLab [AI 绘图 · 图片工具]        查看 · 编辑 · 提示词 · 教程      中文 | EN
```

四个都是首页锚点：`/#inspect`、`/#edit`、`/#prompt`、`/#guides`。
**不要再在每个页面顶栏堆具体工具链接**——工具已经有 12 个，塞不下，而且每加一个工具就要改 24 个文件。具体工具链接只出现在首页卡片和页脚。

页脚保留完整清单，按 A/B/C 三组 + 教程 + 站点信息，分栏排版。

---

## 4. 首页（`/`）应该长什么样

**只保留这一段来做决策依据，实现细节在任务书里。**

- **H1**：`AI 绘图与图片处理工具箱`
- **导语**（2 行以内）：`从查看 16bit 深度图，到给 Stable Diffusion 调提示词权重——十二个工具全部在浏览器里跑。拖进图片或粘贴文本就能用，文件不会离开你的电脑。`
- **三组卡片**（每组一个 `h2` + 一句说明 + 卡片列表）
  - `#inspect` **查看与分析** —— 把图片拆开看：像素坐标、RGB/HEX、直方图、深度值。说明这些工具回答的是「这张图里到底是什么」。
  - `#edit` **编辑与导出** —— 改完直接下载：裁剪、翻转旋转、九宫格分割、抠图。
  - `#prompt` **AI 提示词** —— 写给模型的文字：权重、正反词、负面词库、随机生成、翻译、Token 计数。
  - `#guides` **教程** —— 16bit TIFF 怎么看、取色怎么用、像素检查在查什么。
- **卡片内容**：工具名（链到工具页）+ 一行说明（12–20 字）+ 一个能力标签（`本地` / `首次需下载 6 MB 模型` / `16bit TIFF`）
- **「为什么都在本地跑」** 三条：图片不出浏览器（没有上传接口，断网也能用）；提示词不上服务器（词库、分词表都在页面里）；没有账号、没有额度、没有水印。
- **底部**：一句品牌话 + 页脚。

首页**不要**放工具本体。首页是「目录」，谁想用工具就点进去。

---

## 5. 工具页统一版式

所有 `/tools/*` 用同一套骨架（现有 `.doc tool` + `.tool-*` 类已经够用）：

1. 顶栏（品牌 + 4 个锚点 + 语言切换）
2. `h1` 工具名 + `p.tool-sub` 一句价值（≤40 字）
3. 工具本体（`.dropzone` 或输入框）
4. `section.tool-notes`：**3 个小节 × 120–200 字**，讲怎么用、有什么坑、和其他工具怎么配合 —— 这是每个页面能排上去的正文，不能省
5. `p.related`：2 个相关工具 + 1 篇教程（内链，必须有）
6. 一条固定的「← 全部工具」返回链接（指向 `/#inspect` `/#edit` `/#prompt` 中对应那一组）
7. 页脚

**提示词类工具额外要求**：输入框 + 输出框 + 「复制」+ 「载入示例」四个元素必须齐全；示例要能直接用于 SD/ComfyUI，不要写 `xxx` 占位。

---

## 6. SEO 规范

### 6.1 title / description 字数

| | 中文 | 英文 |
|---|---|---|
| title | ≤ 30 字 | ≤ 60 字符 |
| description | 60–120 字 | 120–160 字符 |

`deploy/check_content.py` 已按这个限制校验，别为了塞关键词把它撑爆——超了就是会被截断，等于白写。

### 6.2 建议的 title（已核对字数，可直接用）

| URL | 中文 title | 英文 title |
|---|---|---|
| `/` | `ImageLab · AI 绘图与图片处理工具箱` | `ImageLab — AI Art & Image Tools in Your Browser` |
| `/tools/pixel-viewer` | `16bit TIFF 深度图与像素查看器` | `16-bit TIFF Depth Map & Pixel Viewer` |
| `/tools/prompt-weight` | `SD 提示词权重计算器 · 括号解析` | `Stable Diffusion Prompt Weight Calculator` |
| `/tools/prompt-split` | `提示词正反词分离工具` | `Stable Diffusion Prompt Splitter` |
| `/tools/negative-prompt` | `负面提示词库 · 一键拼接` | `SD Negative Prompt Builder & Library` |
| `/tools/random-prompt` | `AI 绘图随机提示词生成器` | `Random AI Art Prompt Generator` |
| `/tools/prompt-translate` | `AI 绘图提示词翻译 · 中英对照` | `AI Art Prompt Translator — 中英对照` |
| `/tools/token-counter` | `提示词 Token 计数器` | `Prompt Token Counter — CLIP & OpenAI` |

现有工具页（histogram / crop / flip / grid / remove-bg）的 title 已经能打，只需要把品牌后缀统一，不必重写。

### 6.3 技术项

- **canonical 一律无扩展名**：`https://yangzixiong.com/tools/prompt-weight`
- **hreflang 三行**：zh-CN / en / x-default（x-default 指中文页）
- **JSON-LD**：首页用 `CollectionPage` + `ItemList`（列出全部工具）；工具页继续用 `WebApplication`；教程页保持 `Article`/`HowTo`
- **`og:image` 全部复用** `/img/og-cover.png`，但分享图的文案要换成新定位（见任务书批 1）
- **内链规则**：每个工具页至少链出 2 个同类工具 + 1 篇教程；每篇教程链回 2 个相关工具。不允许出现"只有页脚一条链"的孤岛页。
- **sitemap**：38 条，全部无扩展名；工具页 priority 0.9，教程 0.8，faq/about/privacy 0.5。

### 6.4 迁移说明（重要）

现在的 `/` 是**查看器本体**。改版后 `/` 变成目录页，查看器搬到 `/tools/pixel-viewer`。

- 新旧 URL 都保留可访问，**不需要 301**（`/` 仍是有效页面，只是内容变了）。
- 老访客书签的 `/` 会看到目录页——所以首页必须在最显眼位置放「打开查看器」大按钮。
- 迁移时**整页复制** `index.html` → `tools/pixel-viewer.html`，只改 head 里的 canonical/hreflang/og/JSON-LD 和顶栏，**不要动 body 结构和 id**，否则 `js/main.js` 会全线报错。
- `deploy/check_i18n.py` 会校验中英首页的 id 集合一致，改完首页后这条检查仍然要过。

---

## 7. 与 AdSense 的关系

这次定位调整顺带解决三件事：

1. **内容相关性**：AdSense 讨厌"纯工具零文本"，每个工具页 3 小节说明就是为了这个；
2. **目录页 = 更好的广告位**：首页有真正的长内容，比纯工具页更适合放横幅；
3. **提示词类流量更值钱**：AI 绘图人群的广告单价高于"图片查看器"，eCPM 会有改善。

但申请节奏不变：**域名 + 内容 + 收录**都到位再说，别在改版中途申请。
