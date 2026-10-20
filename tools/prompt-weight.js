"use strict";
/**
 * 提示词权重计算器（页面逻辑，纯浏览器）。
 *
 * 左栏输入 + 方言切换，右栏两块：权重色带 chips（悬停/点击 → 原文定位）
 * 与问题列表（点击 → 选中出错字符）。解析与统计全部走 PromptLib。
 */
(function () {
  var DICT = {
    zh: {
      tokens: "≈ {n} tokens（{s} 段）",
      tokensEmpty: "输入后粗估 CLIP 分词",
      listEmpty: "解析结果显示在这里",
      errNone: "没有发现问题",
      pos: "第 {n} 字符",
      alt: "交替",
      e_DEPTH: "嵌套超过 8 层",
      e_UNCLOSED: "左括号未闭合",
      e_MISMATCH: "括号类型不匹配",
      e_UNMATCHED_CLOSE: "多余的右括号",
      e_WEIGHT_NAN: "权重不是数字",
      e_GENERIC: "语法问题"
    },
    en: {
      tokens: "≈ {n} tokens ({s} seg)",
      tokensEmpty: "CLIP estimate appears as you type",
      listEmpty: "Parsed segments appear here",
      errNone: "No problems found",
      pos: "char {n}",
      alt: "alt",
      e_DEPTH: "Nesting deeper than 8 levels",
      e_UNCLOSED: "Unclosed opening bracket",
      e_MISMATCH: "Mismatched bracket pair",
      e_UNMATCHED_CLOSE: "Stray closing bracket",
      e_WEIGHT_NAN: "Weight is not a number",
      e_GENERIC: "Syntax problem"
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

  var EXAMPLE = "(masterpiece, best quality:1.2), ((detailed face)), [red hair|blue hair], {soft light}, anatomy, (unclosed";

  var els = {};

  function $(id) { return document.getElementById(id); }

  document.addEventListener("DOMContentLoaded", function () {
    els.input = $("pwInput");
    els.list = $("pwList");
    els.errors = $("pwErrors");
    els.tokens = $("pwTokens");
    els.hint = $("pwHint");
    els.example = $("pwExample");

    els.input.addEventListener("input", parse);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="pwDialect"]'), function (r) {
      r.addEventListener("change", parse);
    });
    els.example.addEventListener("click", function () {
      els.input.value = EXAMPLE;
      parse();
      els.input.focus();
      els.input.setSelectionRange(els.input.value.length, els.input.value.length);
    });

    parse();
  });

  function dialect() {
    var r = document.querySelector('input[name="pwDialect"]:checked');
    return r ? r.value : "a1111";
  }

  function locate(from, to) {
    els.input.focus();
    els.input.setSelectionRange(from, to);
  }

  function parse() {
    var text = els.input.value;
    var res = PromptLib.parseWeighted(text, { dialect: dialect() });
    renderList(res);
    renderErrors(res);
    renderTokens(text);
    els.hint.textContent = dialect() === "comfyui"
      ? (document.documentElement.lang === "en"
        ? "ComfyUI dialect: (word) = ×1.0, [a|b] marked as alternation."
        : "ComfyUI 方言：(word) 不加倍，[a|b] 标为交替。")
      : (document.documentElement.lang === "en"
        ? "A1111 dialect: (word) = ×1.1, [word] ÷1.1, {word} ×1.05."
        : "A1111 方言：(word) ×1.1、[word] ÷1.1、{word} ×1.05。");
  }

  function renderList(res) {
    els.list.textContent = "";
    if (!res.items.length) {
      var empty = document.createElement("div");
      empty.className = "pw-empty";
      empty.textContent = tt("listEmpty");
      els.list.appendChild(empty);
      return;
    }
    res.items.forEach(function (it) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "pw-chip b-" + PromptLib.bandOf(it.weight);
      chip.style.marginLeft = Math.min(it.depth, 6) * 12 + "px";

      var w = document.createElement("span");
      w.className = "w";
      w.textContent = String(it.weight);

      var t = document.createElement("span");
      t.className = "t";
      t.textContent = it.text;

      chip.appendChild(w);
      chip.appendChild(t);
      if (it.alternation) {
        var alt = document.createElement("span");
        alt.className = "pw-alt";
        alt.textContent = tt("alt");
        chip.appendChild(alt);
      }
      chip.title = tt("pos", { n: it.from });
      chip.addEventListener("mouseenter", function () { locate(it.from, it.to); });
      chip.addEventListener("click", function () { locate(it.from, it.to); });
      els.list.appendChild(chip);
    });
  }

  function renderErrors(res) {
    els.errors.textContent = "";
    if (!res.errors.length) {
      var ok = document.createElement("li");
      ok.className = "pw-ok";
      ok.style.cursor = "default";
      ok.textContent = tt("errNone");
      ok.addEventListener("click", function (e) { e.stopPropagation(); });
      els.errors.appendChild(ok);
      return;
    }
    res.errors.forEach(function (er) {
      var li = document.createElement("li");
      var msg = tt("e_" + er.code);
      if (msg === "e_" + er.code) msg = er.message;
      li.textContent = msg + " · " + tt("pos", { n: er.from });
      li.addEventListener("click", function () { locate(er.from, er.to); });
      els.errors.appendChild(li);
    });
  }

  function renderTokens(text) {
    if (!text.trim()) {
      els.tokens.textContent = tt("tokensEmpty");
      return;
    }
    var ct = PromptLib.countTokens(text, { vocab: "clip" });
    els.tokens.textContent = tt("tokens", { n: ct.total, s: ct.segments });
  }
})();
