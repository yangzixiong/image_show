# 部署到 Cloudflare Pages（GitHub 自动构建）

本项目是纯静态站点（无构建步骤），走 Cloudflare Pages 的 Git 集成：**以后 push 到 GitHub 就自动上线**。
下面的步骤按顺序做一遍即可，全程免费额度内（Pages 免费版：无限请求与带宽，每月 500 次构建，静态站点足够）。

---

## 第 1 步：把项目推到 GitHub

Cloudflare Pages 的 Git 集成只支持 **GitHub** 和 **GitLab**，不支持 Gitee。如果仓库在 Gitee，需要先建一个 GitHub 仓库。

1. 打开 [repo.new](https://repo.new)，仓库名建议 `image_show`，**不要**勾选 README / .gitignore（本地已有）。
2. 在项目目录执行（本机已 `git init` 并完成首次提交，只需接上远程仓库）：

```powershell
cd D:\yzx_workspace\image_show
git remote add origin https://github.com/<你的GitHub用户名>/image_show.git
git branch -M main
git push -u origin main
```

推送时会要求认证：**GitHub 已不支持账号密码**，需要 Personal Access Token
（GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens，勾选该仓库的 Contents: Read and write），
或者用 GitHub Desktop / Git Credential Manager 登录一次。

> 仓库可以设为 Private，Pages 同样能构建，建站后站点是公开的。

---

## 第 2 步：在 Cloudflare 创建 Pages 项目

1. 打开 [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → **Create application** → **Pages** 标签 → **Import an existing Git repository**。
2. 首次使用需授权 GitHub，选择 `image_show` 仓库 → **Begin setup**。
3. 按下表填写（**这是本项目唯一容易填错的地方**）：

| 配置项 | 填什么 | 说明 |
|---|---|---|
| Project name | `image_show`（可改） | 决定访问地址 `https://<project-name>.pages.dev`；子域名全网唯一，被占用就换一个 |
| Production branch | `main` | |
| Framework preset | **None** | 不要选任何框架 |
| Build command | `exit 0` | 没有构建步骤，用 `exit 0` 占位（官方对纯静态站点的推荐写法） |
| Build output directory | `/` | 站点内容就在仓库根目录 |
| Root directory | 留空 | |

4. 点 **Save and Deploy**，等 1 分钟左右。

**部署完成后的验证清单**（把 `<name>` 换成你的项目名）：

- `https://<name>.pages.dev/` — 首页正常，深色界面和广告位占位都在
- `https://<name>.pages.dev/css/style.css` — 返回 200，且响应头带 `Cache-Control: public, max-age=604800`
- `https://<name>.pages.dev/不存在的路径` — 显示自定义 404 页（Pages 自动使用根目录的 `404.html`，无需配置）
- `https://<name>.pages.dev/robots.txt` — 能正常访问

---

## 第 3 步：把域名回填到 SEO 文件

`robots.txt` 和 `sitemap.xml` 里现在是占位域名 `example.com`，拿到真实地址后替换：

```powershell
cd D:\yzx_workspace\image_show
$site = "https://<name>.pages.dev"
(Get-Content robots.txt)  -replace 'https://example\.com', $site | Set-Content robots.txt -Encoding utf8
(Get-Content sitemap.xml) -replace 'https://example\.com/', "$site/"   | Set-Content sitemap.xml -Encoding utf8
git commit -am "chore: set site url" ; git push
```

push 后 Cloudflare 会自动重新部署，不需要手动操作。

---

## 第 4 步：用 Cloudflare 的能力替代原 nginx 防爬配置

原来的 `deploy/image_show.conf` 在 Cloudflare 上完全不生效（那里没有 nginx）。对应关系：

| 原 nginx 配置 | Cloudflare 上的做法 |
|---|---|
| `expires 7d` / `add_header Cache-Control` | 已由根目录 `_headers` 接管，无需操作 |
| `error_page 404 /404.html` | 自动生效，无需配置 |
| `$bad_bot` 按 UA 返回 403 | Security → WAF → **Custom rules**，表达式见下（**需先绑定自定义域名**，见下） |
| `limit_req 10r/s` 限速 | Security → WAF → Rate limiting rules（免费版规则条数有限，站点流量小可先不做） |
| 垃圾 Referer 拦截 | 同上，用 `http.referer` 写规则 |
| robots.txt 君子协定 | 保留原样，继续生效 |

### 前提：这些开关只对「接入 Cloudflare 的域名」生效

WAF、限速、Bot Fight Mode、Block AI bots 都是**区域（zone）级**功能，只作用于你自己接入 Cloudflare、由 Cloudflare 托管 DNS 的域名。
`<name>.pages.dev` 是 Cloudflare 平台自身的域名，不属于你的 zone，所以：

- 只访问 `*.pages.dev` 时，控制台里**根本不会出现** WAF / Rate limiting / Bots 这些菜单，这不是没找到，是本来就没有
- 此时的防护只有两层：`robots.txt`（守规矩的爬虫）+ 平台默认的 DDoS / 基础防护（不可配置）

想把原 nginx 那套拦截真正还原，前置条件是**先给 Pages 绑一个自己的域名**（见第 5 步）。绑定之后可用的开关：

| 开关 | 位置 | 说明 |
|---|---|---|
| Bot Fight Mode | Security → Bots | 免费版可用，自动挑战云主机来源的简单爬虫与 headless 浏览器 |
| Block AI bots | Security → Bots | 免费版可用，一键拦截 AI 训练爬虫，比只靠 robots.txt 硬 |
| WAF 自定义规则 | Security → WAF → Custom rules | 按 UA 拦截，表达式见下 |
| Rate limiting | Security → WAF → Rate limiting | 免费版规则条数有限，流量小可先不做 |

**自定义规则表达式**（对应原 nginx 的 `$bad_bot`，一个规则即可覆盖）：

```
(lower(http.user_agent) contains "scrapy") or
(lower(http.user_agent) contains "python-requests") or
(lower(http.user_agent) contains "python-urllib") or
(lower(http.user_agent) contains "aiohttp") or
(lower(http.user_agent) contains "httpx") or
(lower(http.user_agent) contains "go-http-client") or
(lower(http.user_agent) contains "okhttp") or
(lower(http.user_agent) contains "semrush") or
(lower(http.user_agent) contains "ahrefsbot") or
(lower(http.user_agent) contains "mj12bot") or
(lower(http.user_agent) contains "dotbot") or
(lower(http.user_agent) contains "petalbot")
```

动作选 **Block**。注意：Cloudflare 自定义规则免费版有条数上限，且**不要**顺手拦 `curl` / `wget`，
否则自己用命令行检查站点时会被挡。

---

## 第 5 步：绑定自定义域名（可选，但要防爬就必须做）

### 子域名（如 `img.example.com`，DNS 可以仍留在原服务商）

1. Pages 项目 → **Custom domains** → **Set up a domain** → 填 `img.example.com`
2. 到原 DNS 服务商加一条 CNAME：`img.example.com` → `<name>.pages.dev`
3. 等待生效，HTTPS 证书由 Cloudflare 自动签发，不用管

顺序很重要：**必须先在 Pages 面板绑定，再去加 CNAME**。反过来做（只加 CNAME 不绑定）会返回 522。

### 主域名（`example.com`）

必须先把域名接入 Cloudflare：在账号里 Add a site，把域名注册商处的 **NS 记录改成 Cloudflare 给的两条**，
等状态变成 Active。这一步完成后，Pages 面板才能为 apex 域名自动建记录。

绑定成功后，左侧才会出现 WAF / Bots / Rate limiting 这些 zone 级菜单（见第 4 步）。
**别忘了**：换用自定义域名后，第 3 步填进 `robots.txt` / `sitemap.xml` 的地址也要跟着改。

---

## 日常更新流程

改完代码，两条命令上线：

```powershell
git add -A
git commit -m "描述改了什么"
git push
```

Cloudflare 自动构建约 1 分钟生效。非 `main` 分支的 push 会生成独立的预览地址（`<hash>.<name>.pages.dev`），
可以先看效果再合并。

---

## 需要知道的几个约束

- **Git 集成之后不能改成 Direct Upload**（Cloudflare 的硬限制）。仍想用命令行直传时，可以在项目设置里关掉自动部署，再用 `npx wrangler pages deploy .` 推，但项目类型不变。
- **`_headers` 对 HTML 之外的文件按路径通配**：本项目用的是 `/*.css`、`/*.js` 这类后缀匹配。以后新增资源目录（比如 `img/`）如果也想长缓存，需要在 `_headers` 里补一条规则。
- **CSS/JS 文件名不含内容哈希**：`max-age=604800` 意味着改完样式后，老访客最多 7 天内可能仍用旧缓存。想改完立刻生效，就把 `_headers` 里对应 `max-age` 调小。
- **`.assetsignore`** 用于把 `README.md`、`deploy/` 排除在发布内容之外；如果 Cloudflare 的上传器忽略它，最坏结果只是这些文件能被直接访问，不影响站点运行。
- **别忘了 `ads.txt`**：接入 AdSense 后要填发布商 ID 并推一次，否则广告收益归属校验会失败。

---

## 参考

- [Static HTML 部署指南](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)
- [Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [`_headers` 语法](https://developers.cloudflare.com/pages/configuration/headers/)
- [免费版 Bot 防护能力](https://developers.cloudflare.com/bots/plans/free/)
