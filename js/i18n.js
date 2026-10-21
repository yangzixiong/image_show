"use strict";
/**
 * ImageLab 多语言文案表（只存放「由 JS 生成」的文本）
 *
 * 设计取舍：
 *   - 页面上的静态文字直接写在各自的 HTML 里（/index.html 中文、/en/index.html 英文），
 *     这样爬虫不执行 JS 也能读到完整内容，禁用 JS 的用户也看得懂。
 *   - 本文件只负责 JS 运行时拼出来的字符串（toast、侧栏提示、深度值等）。
 *   - 语言由 <html lang="..."> 决定；首访的浏览器语言自动切换由 js/lang-boot.js 负责
 *     （跳过爬虫、尊重用户在顶栏点过的显式选择），本文件不做任何跳转。
 *
 * 新增语言：在 DICT 里加一份文案，再复制一份 HTML 到对应目录即可。
 */
var I18N = (function () {
  var DICT = {
    zh: {
      "ui.noImages": "暂无图片，拖入或点击「打开图片」",
      "ui.langHint": "查看中文版 →",

      "toast.noFiles": "未发现可识别的图片文件",
      "toast.decodeFail": "无法解析: {name}",
      "toast.copied": "已复制  {value}",

      "label.depthImage": " · 深度图",
      "label.depth16": " · 16bit",
      "label.range": "范围: {min} ~ {max} mm",
      "label.zeroInvalid": "（0 = 无效值）",
      "label.depthValue": "深度: {value}",
      "label.invalid": "无效",

      "pos.none": "X: -  Y: -",
      "rgb.none": "R: -  G: -  B: -",
      "rgb.values": "R: {r}  G: {g}  B: {b}",

      "tip.depth": "深度 {value}  ·  {hex}",
      "tip.copyHint": "（点击复制）",

      "picker.zeroInvalid": "0 mm (无效)",

      "tool.noImage": "请先选择一张图片",
      "tool.decodeFail": "无法解析: {name}",
      "hist.empty": "尚未载入图片",
      "hist.size": "尺寸: {w} × {h}",
      "hist.samples": "采样: {n} 像素",
      "hist.mean": "平均亮度: {v}",
      "hist.clipLow": "暗部溢出: {p}%",
      "hist.clipHigh": "高光溢出: {p}%",
      "hist.depthValid": "有效像素: {n}",
      "hist.depthInvalid": "无效像素 (0): {n}",
      "hist.depthRange": "范围: {min} ~ {max} mm",
      "hist.depthMean": "平均深度: {v} mm",
      "flip.outSize": "输出尺寸: {w} × {h}",
      "flip.downloaded": "已下载 {name}（{size}）"
    },

    en: {
      "ui.noImages": "No images yet — drop one here or click “Open image”",
      "ui.langHint": "View this page in English →",

      "toast.noFiles": "No recognisable image files found",
      "toast.decodeFail": "Could not decode: {name}",
      "toast.copied": "Copied  {value}",

      "label.depthImage": " · depth map",
      "label.depth16": " · 16-bit",
      "label.range": "Range: {min} ~ {max} mm",
      "label.zeroInvalid": " (0 = invalid)",
      "label.depthValue": "Depth: {value}",
      "label.invalid": "invalid",

      "pos.none": "X: -  Y: -",
      "rgb.none": "R: -  G: -  B: -",
      "rgb.values": "R: {r}  G: {g}  B: {b}",

      "tip.depth": "Depth {value}  ·  {hex}",
      "tip.copyHint": " (click to copy)",

      "picker.zeroInvalid": "0 mm (invalid)",

      "tool.noImage": "Choose an image first",
      "tool.decodeFail": "Could not decode: {name}",
      "hist.empty": "No image loaded yet",
      "hist.size": "Size: {w} × {h}",
      "hist.samples": "Sampled: {n} px",
      "hist.mean": "Mean luminance: {v}",
      "hist.clipLow": "Shadow clipping: {p}%",
      "hist.clipHigh": "Highlight clipping: {p}%",
      "hist.depthValid": "Valid pixels: {n}",
      "hist.depthInvalid": "Invalid (0): {n}",
      "hist.depthRange": "Range: {min} ~ {max} mm",
      "hist.depthMean": "Mean depth: {v} mm",
      "flip.outSize": "Output size: {w} × {h}",
      "flip.downloaded": "Downloaded {name} ({size})"
    }
  };

  var FALLBACK = "zh";
  var PREF_KEY = "imagelab.lang";

  // 语言来自 <html lang="zh-CN"> 或 <html lang="en">
  var LANG = (function () {
    var l = (document.documentElement.getAttribute("lang") || "zh").toLowerCase();
    return l.indexOf("en") === 0 ? "en" : "zh";
  })();

  var warned = {};

  function t(key, vars) {
    var table = DICT[LANG] || DICT[FALLBACK];
    var s = table[key];
    if (s === undefined) {
      // 缺 key 时回落中文并只警告一次，避免控制台被刷屏
      if (!warned[key] && window.console) {
        warned[key] = 1;
        console.warn("[i18n] 缺少文案 key: " + key + "（语言: " + LANG + "）");
      }
      s = DICT[FALLBACK][key] !== undefined ? DICT[FALLBACK][key] : key;
    }
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, name) {
      return vars[name] === undefined ? m : String(vars[name]);
    });
  }

  function lang() { return LANG; }

  function readPref() {
    try { return localStorage.getItem(PREF_KEY); } catch (e) { return null; }
  }

  /** 记住用户点过的语言版本（只记录，不自动跳转） */
  function bindSwitcher() {
    var links = document.querySelectorAll("[data-lang-switch]");
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener("click", function () {
        try { localStorage.setItem(PREF_KEY, this.getAttribute("data-lang-switch")); } catch (e) {}
      });
    }
  }

  /** 另一种语言下同一页面的路径（/tools/x ↔ /en/tools/x），没有对应页时退回该语言首页 */
  function counterpartPath(target) {
    var path = location.pathname || "/";
    if (target === "en") {
      if (path === "/") return "/en/";
      if (path.indexOf("/en/") === 0) return path;
      return "/en" + path;
    }
    var p = path.replace(/^\/en(\/|$)/, "/");
    return p === "" ? "/" : p;
  }

  /** 如果访客上次选了另一种语言，就在顶栏给一个不打扰的入口 */
  function showPrefHint() {
    var pref = readPref();
    if (!pref || pref === LANG || !DICT[pref]) return;
    var box = document.getElementById("langHint");
    if (!box) return;
    // 指向「同一页的另一语言版本」，而不是语言首页
    box.href = counterpartPath(pref);
    box.textContent = (DICT[pref]["ui.langHint"]) || box.textContent;
    box.hidden = false;
  }

  function boot() {
    bindSwitcher();
    showPrefHint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return { t: t, lang: lang };
})();

/** 全局快捷方式，供 main.js / inspector.js / picker.js 直接调用 */
function t(key, vars) { return I18N.t(key, vars); }
