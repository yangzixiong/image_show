/* ImageLab Service Worker
 *
 * 分层策略（每层解决一个具体问题）：
 *   1. 导航请求（HTML）：network-first —— 发版即生效，断网时回退到缓存副本。
 *   2. /data/*.json（运营数据）：network-first + 3 秒超时回退 —— 词库/负面词更新
 *      能真正送到用户手里，又不至于在弱网下白屏。
 *   3. 带 ?v= 的 /js/ 与 /css/：cache-first —— 版本号变了缓存键就变了。
 *   4. 不带 ?v= 的静态资源（/lib/*.js、/img/*、favicon…）：cache-first，
 *      但整站缓存名带版本号（VERSION），发版时改 VERSION 即整体失效，
 *      否则这些文件对老访客会被永久钉在旧版本。
 *   5. /models/、/lib/ort/、/data/tok/：永不缓存（合计约 29 MB，会爆存储配额）。
 *
 * 发版纪律：改动任何静态资源后，把下面 VERSION 往上加一位，
 * 否则老访客会继续命中旧缓存（HTML 是网络优先，但 JS/图片不是）。
 */
"use strict";

var VERSION = "v2";
var CACHE = "imagelab-" + VERSION;
var NEVER = ["/models/", "/lib/ort/", "/data/tok/"];
var DATA = ["/data/"];
var DATA_TIMEOUT = 3000;   // 运营数据请求的网络超时（毫秒）

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var i;
  for (i = 0; i < NEVER.length; i++) {
    if (url.pathname.indexOf(NEVER[i]) === 0) return; // 大文件直连网络，不进缓存
  }
  if (req.mode === "navigate") {
    e.respondWith(netFirst(req));
    return;
  }
  for (i = 0; i < DATA.length; i++) {
    if (url.pathname.indexOf(DATA[i]) === 0) {
      e.respondWith(dataFirst(req));
      return;
    }
  }
  e.respondWith(cacheFirst(req));
});

/* 导航：网络优先；离线时回退缓存；连缓存都没有就明确报离线，
 * 不用首页 HTML 顶替（那会在工具 URL 上渲染出毫不相干的中文首页）。 */
function netFirst(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) {
      caches.open(CACHE).then(function (c) { return c.put(req, res.clone()); }).catch(function () {});
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (m) {
      return m || new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    });
  });
}

/* 运营数据：网络优先（3 秒超时），失败回退缓存——保证词库更新能到用户 */
function dataFirst(req) {
  return fetchWithTimeout(req, DATA_TIMEOUT).then(function (res) {
    if (res && res.ok) {
      caches.open(CACHE).then(function (c) { return c.put(req, res.clone()); }).catch(function () {});
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (m) {
      return m || new Response("{}", {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    });
  });
}

function fetchWithTimeout(req, ms) {
  if (typeof AbortController !== "function") return fetch(req);
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, ms);
  return fetch(req, { signal: ctrl.signal }).then(function (res) {
    clearTimeout(timer);
    return res;
  }, function (err) {
    clearTimeout(timer);
    throw err;
  });
}

/* 其余静态资源：缓存优先，命中即用；缓存键含 ?v=，版本号变则自然失效 */
function cacheFirst(req) {
  return caches.match(req).then(function (m) {
    if (m) return m;
    return fetch(req).then(function (res) {
      if (res && res.ok && res.type === "basic") {
        caches.open(CACHE).then(function (c) { return c.put(req, res.clone()); }).catch(function () {});
      }
      return res;
    });
  });
}
