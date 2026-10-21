"use strict";
/**
 * 首访语言自动切换（lang-boot）：
 *   - localStorage 里已有用户点过的语言偏好（imagelab.lang）→ 永不跳转，尊重显式选择；
 *   - 无偏好时取 navigator.languages 首项与 <html lang> 比较，不符则 location.replace 换语言路径；
 *   - 保留 ?query 与 #hash（如随机生成器的 ?seed= 分享链接、首页分区锚点）；
 *   - 爬虫（UA 含 bot/crawl/spider 等）与无头浏览器（navigator.webdriver）一律跳过，
 *     保证搜索引擎各自索引中英两个版本，不互相干扰；
 *   - 放在 <head> 最前执行，首绘前完成跳转，无闪烁。目标页语言与浏览器一致，自然 no-op，无循环。
 *
 * 语言偏好保存（委托监听）：i18n.js 只在 16 个页面加载，无法承担全站的偏好保存，
 * 而 lang-boot 内联于全部页面 <head>——在此用 document 级委托捕获所有带
 * data-lang-switch 的链接点击（顶栏、页脚、提示框，含未来新增入口），
 * 在跳转前写入 imagelab.lang，防止目标页按浏览器语言把用户弹回。
 */
(function () {
  var PREF_KEY = "imagelab.lang";

  // 点击任何跨语言链接 = 显式偏好，先于导航写入 localStorage
  document.addEventListener("click", function (e) {
    var a = e.target;
    if (!a) return;
    if (a.closest) {
      a = a.closest("a");
    } else {
      while (a && a.tagName !== "A") a = a.parentNode;
    }
    if (!a || !a.getAttribute) return;
    var v = a.getAttribute("data-lang-switch");
    if (v !== "en" && v !== "zh") return;
    try { localStorage.setItem(PREF_KEY, v); } catch (err) {}
  });

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
