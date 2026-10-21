"use strict";
/**
 * 提示词翻译（页面逻辑，纯浏览器）。
 *
 * 词条表来自 /data/prompt-terms.json（zh/en + 同义词 + 固定写法）；
 * 按逗号/顿号/换行切词，精确匹配 zh↔en 双向；未命中的词进「未收录」区。
 * 固定写法（1girl、8k 等）整词匹配，不会被拆开翻译。
 */
(function () {
  var DICT = {
    zh: {
      loading: "正在载入词条表…",
      loaded: "词条表就绪：{n} 条",
      loadFail: "词条表载入失败——可先手动整理文本",
      unmatched: "未收录（{n}）",
      unmatchedHint: "以下词在词条表中没有对应，已原样保留在输出里；欢迎补充 data/prompt-terms.json",
      noUnmatched: "全部命中",
      copied: "已复制",
      copyFail: "复制失败，请手动选择文本",
      empty: "先输入要翻译的内容",
      stat: "命中 {k}/{n} · 未收录 {u}"
    },
    en: {
      loading: "Loading term table…",
      loaded: "Term table ready: {n} entries",
      loadFail: "Term table failed to load — you can still translate by hand",
      unmatched: "Not covered ({n})",
      unmatchedHint: "These words have no entry yet and were kept as-is; contributions to data/prompt-terms.json are welcome",
      noUnmatched: "All covered",
      copied: "Copied",
      copyFail: "Copy failed — select the text manually",
      empty: "Type something to translate first",
      stat: "{k}/{n} matched · {u} uncovered"
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

  var terms = [];
  var zhMap = {};     // zh 精确 + syn → entry
  var enMap = {};     // en 精确 + enSyn → entry（键小写）
  var CJK_RE = /[\u3000-\u9fff\uff00-\uffef]/;
  var els = {};

  function $(id) { return document.getElementById(id); }

  function direction() {
    var r = document.querySelector('input[name="ptDir"]:checked');
    return r ? r.value : "zh2en";
  }

  document.addEventListener("DOMContentLoaded", function () {
    els.input = $("ptInput");
    els.out = $("ptOut");
    els.miss = $("ptMiss");
    els.missBox = $("ptMissBox");
    els.stat = $("ptStat");
    els.load = $("ptLoad");

    els.input.addEventListener("input", translate);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="ptDir"]'), function (r) {
      r.addEventListener("change", translate);
    });
    $("ptCopy").addEventListener("click", function () {
      if (!els.out.value) { Toolkit.toast(tt("empty")); return; }
      copyText(els.out.value);
    });

    translate();
    fetchTerms();
  });

  function setLoad(msg) {
    if (els.load) els.load.textContent = msg;
  }

  function fetchTerms() {
    setLoad(tt("loading"));
    fetch("/data/prompt-terms.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        terms = (json && Array.isArray(json.terms)) ? json.terms : [];
        buildMaps();
        setLoad(tt("loaded", { n: terms.length }));
        translate();
      })
      .catch(function () {
        setLoad(tt("loadFail"));
        translate();
      });
  }

  function buildMaps() {
    zhMap = {};
    enMap = {};
    terms.forEach(function (t) {
      if (t.zh) zhMap[t.zh] = t;
      (t.syn || []).forEach(function (s) { if (!zhMap[s]) zhMap[s] = t; });
      if (t.en) enMap[t.en.toLowerCase()] = t;
      (t.enSyn || []).forEach(function (s) {
        var k = s.toLowerCase();
        if (!enMap[k]) enMap[k] = t;
      });
    });
  }

  function translate() {
    var raw = els.input.value;
    var dir = direction();
    var tokens = raw.split(/[,，、;；\n]+/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s; });
    var out = [];
    var missed = [];
    var hit = 0;

    tokens.forEach(function (tok) {
      var entry = null;
      if (dir === "zh2en") {
        entry = zhMap[tok] || null;
        if (!entry && !CJK_RE.test(tok)) entry = enMap[tok.toLowerCase()] || null;
        if (entry) { out.push(entry.en); hit++; }
        else { out.push(tok); missed.push(tok); }
      } else {
        entry = enMap[tok.toLowerCase()] || null;
        if (!entry && CJK_RE.test(tok)) entry = zhMap[tok] || null;
        if (entry) { out.push(entry.zh); hit++; }
        else { out.push(tok); missed.push(tok); }
      }
    });

    els.out.value = out.join(", ");
    els.stat.textContent = tt("stat", { k: hit, n: tokens.length, u: missed.length });
    renderMiss(missed);
  }

  function renderMiss(missed) {
    els.miss.textContent = "";
    if (!missed.length) {
      els.missBox.hidden = true;
      return;
    }
    els.missBox.hidden = false;
    var title = document.createElement("div");
    title.className = "pt-miss-title";
    title.textContent = tt("unmatched", { n: missed.length });
    els.miss.appendChild(title);
    missed.forEach(function (tok) {
      var chip = document.createElement("span");
      chip.className = "pt-chip";
      chip.textContent = tok;
      els.miss.appendChild(chip);
    });
    var hint = document.createElement("p");
    hint.className = "pt-miss-hint";
    hint.textContent = tt("unmatchedHint");
    els.miss.appendChild(hint);
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
