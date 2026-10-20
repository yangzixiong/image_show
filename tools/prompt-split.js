"use strict";
/**
 * 提示词正反词分离（页面逻辑，纯浏览器）。
 *
 * 输入即时拆分：PromptLib.splitPositiveNegative 认格式，
 * 页面只负责把 positive/negative/unknown 三段写回对应框并提示识别结果。
 */
(function () {
  var DICT = {
    zh: {
      detIdle: "等待粘贴提示词",
      detJson: "识别到 JSON 字段（prompt / negative_prompt）",
      detLabel: "识别到 Positive / Negative prompt 标签",
      detHash: "识别到 ### 分隔线",
      detFlag: "识别到 Midjourney --no 参数",
      detBlank: "识别到空行分隔",
      detNone: "未识别到分隔格式：整段作为正面词",
      copied: "已复制",
      copyFail: "复制失败，请手动选择文本",
      emptyNothing: "先粘贴一段提示词"
    },
    en: {
      detIdle: "Paste a prompt to split it",
      detJson: "Detected JSON fields (prompt / negative_prompt)",
      detLabel: "Detected Positive / Negative prompt labels",
      detHash: "Detected ### separator line",
      detFlag: "Detected Midjourney --no flag",
      detBlank: "Detected blank-line separator",
      detNone: "No separator recognised: the whole paste is positive",
      copied: "Copied",
      copyFail: "Copy failed — select the text manually",
      emptyNothing: "Paste a prompt first"
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

  var els = {};

  function $(id) { return document.getElementById(id); }

  document.addEventListener("DOMContentLoaded", function () {
    els.input = $("psInput");
    els.detect = $("psDetect");
    els.positive = $("psPositive");
    els.negative = $("psNegative");
    els.unknown = $("psUnknown");
    els.unknownWrap = $("psUnknownWrap");
    els.clear = $("psClear");
    els.copyPos = $("psCopyPos");
    els.copyNeg = $("psCopyNeg");

    els.input.addEventListener("input", split);
    els.clear.addEventListener("click", function () {
      els.input.value = "";
      split();
      els.input.focus();
    });
    els.copyPos.addEventListener("click", function () { copyBox(els.positive); });
    els.copyNeg.addEventListener("click", function () { copyBox(els.negative); });

    split();
  });

  function detectKey(res) {
    if (res.detected === "labeled") return res.detectedDetail === "json" ? "detJson" : "detLabel";
    if (res.detected === "separator") return res.detectedDetail === "hash" ? "detHash" : "detFlag";
    if (res.detected === "blankline") return "detBlank";
    return "detNone";
  }

  function split() {
    var raw = els.input.value;
    if (!raw.trim()) {
      els.detect.textContent = tt("detIdle");
      els.positive.value = "";
      els.negative.value = "";
      els.unknown.value = "";
      els.unknownWrap.hidden = true;
      return;
    }
    var res = PromptLib.splitPositiveNegative(raw);
    els.detect.textContent = tt(detectKey(res));
    els.positive.value = res.positive;
    els.negative.value = res.negative;
    els.unknown.value = res.unknown;
    els.unknownWrap.hidden = !res.unknown.trim();
  }

  function copyBox(box) {
    if (!box.value) {
      Toolkit.toast(tt("emptyNothing"));
      return;
    }
    copyText(box.value);
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
