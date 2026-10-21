/* ImageLab Service Worker
 * 只缓存 HTML 与小型静态资源；绝不拦截 /models/、/lib/ort/、/data/tok/（合计约 29 MB，会爆存储配额）。
 * HTML 走 network-first（离线时回退缓存，发版即生效）；
 * 其余同源 GET 走 cache-first（站点资源用 ?v= 版本号引用，换版本即换缓存键）。
 * 缓存条目受站点自身资源总量约束（页面与静态文件数量有限），无需额外裁剪。
 */
"use strict";

var CACHE = "imagelab-v1";
var NEVER = ["/models/", "/lib/ort/", "/data/tok/"];

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
  for (var i = 0; i < NEVER.length; i++) {
    if (url.pathname.indexOf(NEVER[i]) === 0) return; // 大文件直连网络，不进缓存
  }
  if (req.mode === "navigate") {
    e.respondWith(netFirst(req));
  } else {
    e.respondWith(cacheFirst(req));
  }
});

function netFirst(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) {
      caches.open(CACHE).then(function (c) { return c.put(req, res.clone()); }).catch(function () {});
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (m) {
      return m || caches.match("/").then(function (home) {
        return home || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      });
    });
  });
}

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
