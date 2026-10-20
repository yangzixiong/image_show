// 线上 4xx 排查：把每个 HTML 里的站内 href/src 映射成磁盘路径，逐段做大小写精确比对。
// 本地 Windows 不区分大小写，check_content.py 的 Path.exists() 会放过 case 不一致的链接，
// 而 Cloudflare 线上是 Linux，大小写不符直接 404 —— 这是最典型的"本地全绿、线上 4xx"。
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, posix } from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p.replace(/\\/g, "/"));
  }
  return out;
}

const all = walk(".");
const files = new Set(all);
const lowerMap = new Map();
for (const f of all) {
  const k = f.toLowerCase();
  if (!lowerMap.has(k)) lowerMap.set(k, []);
  lowerMap.get(k).push(f);
}

const htmls = all.filter((f) => f.endsWith(".html"));
const caseIssues = new Map(); // href -> {want, have}
const missing = new Map();    // href -> pages[]
const checked = new Set();

function resolve(urlPath) {
  let p = urlPath;
  if (p.endsWith("/")) p += "index.html";
  const candidates = [p, p + ".html", p + "/index.html"];
  for (const c of candidates) {
    const rel = c.replace(/^\//, "");
    if (files.has(rel)) return { ok: true, rel };
  }
  // 大小写不敏感地找一下，判断是"真的不存在"还是"大小写不符"
  for (const c of candidates) {
    const rel = c.replace(/^\//, "").toLowerCase();
    const hit = lowerMap.get(rel);
    if (hit && hit.length) return { ok: false, caseWrong: true, rel: hit[0], asked: c.replace(/^\//, "") };
  }
  return { ok: false };
}

for (const page of htmls) {
  const src = readFileSync(page, "utf8");
  const refs = [...src.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const raw of refs) {
    if (/^(https?:|mailto:|tel:|data:|javascript:|#)/i.test(raw)) continue;
    if (!raw.startsWith("/")) continue; // 相对路径单独看
    const clean = raw.split("#")[0].split("?")[0];
    if (!clean) continue;
    if (checked.has(clean)) continue;
    checked.add(clean);
    const r = resolve(clean);
    if (r.ok) continue;
    if (r.caseWrong) caseIssues.set(clean, { asked: r.asked, onDisk: r.rel });
    else missing.set(clean, []);
  }
}

// 相对路径也检查一遍（相对页面所在目录）
for (const page of htmls) {
  const src = readFileSync(page, "utf8");
  const dir = posix.dirname(page);
  for (const m of src.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const raw = m[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:|#|\/)/i.test(raw)) continue;
    const clean = raw.split("#")[0].split("?")[0];
    if (!clean) continue;
    const rel = posix.normalize(posix.join(dir, clean));
    if (files.has(rel) || files.has(posix.join(rel, "index.html"))) continue;
    if (!missing.has(rel)) missing.set(rel, []);
    missing.get(rel).push(page);
  }
}

console.log(`HTML 页面: ${htmls.length}，站内绝对路径引用: ${checked.size}`);
console.log(`\n[大小写不符] ${caseIssues.size}`);
for (const [href, v] of caseIssues) console.log(`  ${href}  -> 磁盘上是 ${v.onDisk}`);
console.log(`\n[磁盘上不存在] ${missing.size}`);
for (const [p, pages] of missing) console.log(`  ${p}   (被 ${pages.length ? pages.slice(0, 3).join(", ") : "?"} 引用)`);
