"use strict";
/**
 * 负面提示词库（页面逻辑，纯浏览器）。
 *
 * 词库来自 /data/negative-prompts.json（fetch，失败仅降级为自定义框可用）；
 * 勾选/自定义变化都经 PromptLib.buildNegative 去重拼接后写回预览。
 * 复制一对 = 正面 + 空行 + 负面（与正反词分离的 blankline 格式互逆）。
 */
(function () {
  var DICT = {
    zh: {
      loading: "正在载入词库…",
      loaded: "词库就绪：{n} 个词条",
      loadFail: "词库载入失败——自定义框仍可使用",
      stat: "已选 {k} 条 · 输出 {c} 字符",
      emptyNeg: "先勾选词条或填写自定义内容",
      emptyPos: "先填写正面提示词",
      copied: "已复制",
      copyFail: "复制失败，请手动选择文本"
    },
    en: {
      loading: "Loading library…",
      loaded: "Library ready: {n} entries",
      loadFail: "Library failed to load — the custom box still works",
      stat: "{k} ticked · {c} characters output",
      emptyNeg: "Tick entries or type custom text first",
      emptyPos: "Fill in the positive prompt first",
      copied: "Copied",
      copyFail: "Copy failed — select the text manually"
    }
  };

  function tt(key, vars) {
    var lang = document.documentElement.lang === "en" ? "en" : "zh";
    var s = DICT[lang][key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace("{" + k + "}", vars[k]);
      });
    }
    return s;
  }

  var lib = { groups: [] };
  var els = {};

  function $(id) { return document.getElementById(id); }

  document.addEventListener("DOMContentLoaded", function () {
    els.groups = $("npGroups");
    els.custom = $("npCustom");
    els.out = $("npOut");
    els.pos = $("npPos");
    els.stat = $("npStat");
    els.load = $("npLoad");
    els.copyNeg = $("npCopyNeg");
    els.copyPair = $("npCopyPair");

    els.groups.addEventListener("change", recompute);
    els.custom.addEventListener("input", recompute);
    els.copyNeg.addEventListener("click", function () {
      if (!els.out.value) { Toolkit.toast(tt("emptyNeg")); return; }
      copyText(els.out.value);
    });
    els.copyPair.addEventListener("click", function () {
      if (!els.pos.value.trim()) { Toolkit.toast(tt("emptyPos")); return; }
      if (!els.out.value) { Toolkit.toast(tt("emptyNeg")); return; }
      copyText(els.pos.value.replace(/\s+$/, "") + "\n\n" + els.out.value);
    });

    recompute();
    fetchLib();
  });

  function fetchLib() {
    els.load.textContent = tt("loading");
    fetch("/data/negative-prompts.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        lib = (data && Array.isArray(data.groups)) ? data : { groups: [] };
        var n = 0;
        lib.groups.forEach(function (g) { n += (g.items || []).length; });
        els.load.textContent = tt("loaded", { n: n });
        renderLib();
        recompute();
      })
      .catch(function () {
        els.load.textContent = tt("loadFail");
        recompute();
      });
  }

  function renderLib() {
    var lang = document.documentElement.lang === "en" ? "en" : "zh";
    els.groups.textContent = "";
    lib.groups.forEach(function (g) {
      var box = document.createElement("div");
      box.className = "np-group";

      var gt = document.createElement("strong");
      gt.className = "np-gt";
      gt.textContent = (g.label && g.label[lang]) || g.id;
      box.appendChild(gt);

      var items = document.createElement("div");
      items.className = "np-items";
      (g.items || []).forEach(function (it) {
        var lab = document.createElement("label");
        lab.className = "np-item";

        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.setAttribute("data-id", it.id);

        var code = document.createElement("code");
        code.textContent = it.text;

        var mean = document.createElement("span");
        mean.className = "np-mean";
        mean.textContent = (it.label && it.label[lang]) || "";

        lab.appendChild(cb);
        lab.appendChild(code);
        lab.appendChild(mean);
        items.appendChild(lab);
      });
      box.appendChild(items);
      els.groups.appendChild(box);
    });
  }

  function recompute() {
    var ids = [];
    Array.prototype.forEach.call(
      els.groups.querySelectorAll('input[type="checkbox"]:checked'),
      function (cb) { ids.push(cb.getAttribute("data-id")); }
    );
    var line = PromptLib.buildNegative(ids, els.custom.value, lib);
    els.out.value = line;
    els.stat.textContent = tt("stat", { k: ids.length, c: line.length });
  }

  function copyText(s) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).then(function () {
        Toolkit.toast(tt("copied"));
      }).catch(function () {
        legacyCopy(s);
      });
    } else {
      legacyCopy(s);
    }
  }

  function legacyCopy(s) {
    var ta = document.createElement("textarea");
    ta.value = s;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    Toolkit.toast(tt(ok ? "copied" : "copyFail"));
  }
})();
