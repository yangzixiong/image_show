"use strict";
/**
 * 首访语言自动切换（lang-boot）：
 *   - localStorage 里已有用户点过的语言偏好（imagelab.lang）→ 永不跳转，尊重显式选择；
 *   - 无偏好时取 navigator.languages 首项与 <html lang> 比较，不符则 location.replace 换语言路径；
 *   - 保留 ?query 与 #hash（如随机生成器的 ?seed= 分享链接、首页分区锚点）；
 *   - 爬虫（UA 含 bot/crawl/spider 等）与无头浏览器（navigator.webdriver）一律跳过，
 *     保证搜索引擎各自索引中英两个版本，不互相干扰；
 *   - 放在 <head> 最前执行，首绘前完成跳转，无闪烁。目标页语言与浏览器一致，自然 no-op，无循环。
 */
(function () {
  var PREF_KEY = "imagelab.lang";
  try {
    if (localStorage.getItem(PREF_KEY)) return;

    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    if (!nav) return;
    var wantEn = !/^zh/i.test(nav);

    var curLang = (document.documentElement.getAttribute("lang") || "zh").toLowerCase();
    var curEn = curLang.indexOf("en") === 0;
    if (wantEn === curEn) return;

    if (navigator.webdriver === true) return;
    var ua = navigator.userAgent || "";
    if (/bot|crawl|spider|slurp|headless|lighthouse|mediapartners|adsbot|feedfetcher|scrapy|python|curl|wget|okhttp|httpx|go-http-client|monitoring|pingdom/i.test(ua)) return;

    var path = location.pathname;
    var next;
    if (wantEn) {
      next = path === "/" ? "/en/" : "/en" + path;
    } else {
      next = path.replace(/^\/en(\/|$)/, "/");
      if (next === "") next = "/";
    }
    location.replace(next + location.search + location.hash);
  } catch (e) {}
})();
