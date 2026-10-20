"use strict";
/**
 * 随机提示词生成器（页面逻辑，纯浏览器）。
 *
 * 六层各随机抽一条（权重加权），可单层锁定/单层重抽；
 * ?seed= 可复现整组结果，「复制分享链接」把当前 seed 带上。
 * 数据来自 /data/random-prompts.json（fetch，失败仅降级为空）。
 */
(function () {
  var DICT = {
    zh: {
      loading: "正在载入词库…",
      loaded: "词库就绪：{n} 条 · 6 层",
      loadFail: "词库载入失败，请刷新重试",
      seedLabel: "随机种子",
      lock: "锁定",
      locked: "已锁定",
      reroll: "换一个",
      roll: "全部重抽",
      share: "复制分享链接",
      copy: "复制提示词",
      copied: "已复制",
      copyFail: "复制失败，请手动选择文本",
      shareCopied: "分享链接已复制",
      stat: "{n} 条标签 · ≈{t} tokens（CLIP）",
      empty: "载入词库后开始随机"
    },
    en: {
      loading: "Loading prompt pool…",
      loaded: "Pool ready: {n} entries · 6 layers",
      loadFail: "Failed to load the pool — please refresh",
      seedLabel: "Seed",
      lock: "Lock",
      locked: "Locked",
      reroll: "Reroll",
      roll: "Reroll all",
      share: "Copy share link",
      copy: "Copy prompt",
      copied: "Copied",
      copyFail: "Copy failed — select the text manually",
      shareCopied: "Share link copied",
      stat: "{n} tags · ≈{t} tokens (CLIP)",
      empty: "Random results appear once the pool loads"
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

  var data = { layers: [] };
  var picks = [];      // 每层当前抽中的 item 下标
  var locks = [];      // 每层是否锁定
  var rng = null;
  var seed = 0;
  var els = {};

  function $(id) { return document.getElementById(id); }

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function weightedPick(items) {
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += (items[i].w || 1);
    var r = rng() * total;
    for (i = 0; i < items.length; i++) {
      r -= (items[i].w || 1);
      if (r < 0) return i;
    }
    return items.length - 1;
  }

  function mode() {
    var r = document.querySelector('input[name="rpMode"]:checked');
    return r ? r.value : "tags";
  }

  document.addEventListener("DOMContentLoaded", function () {
    els.layers = $("rpLayers");
    els.out = $("rpOut");
    els.seed = $("rpSeed");
    els.stat = $("rpStat");
    els.load = $("rpLoad");

    $("rpRoll").addEventListener("click", function () {
      if (!data.layers.length) return;
      seed = (Math.random() * 0x100000000) >>> 0;
      rng = mulberry32(seed);
      drawAll(false);
      syncSeed();
      renderOut();
    });
    $("rpShare").addEventListener("click", function () {
      if (!data.layers.length) return;
      var url = location.origin + location.pathname + "?seed=" + seed;
      copyText(url, "shareCopied");
      try { history.replaceState(null, "", location.pathname + "?seed=" + seed); } catch (e) { /* ignore */ }
    });
    $("rpCopy").addEventListener("click", function () {
      if (!els.out.value) { Toolkit.toast(tt("empty")); return; }
      copyText(els.out.value, "copied");
    });
    els.seed.addEventListener("change", function () {
      var v = parseInt(els.seed.value, 10);
      if (isNaN(v) || v < 0) return;
      seed = v >>> 0;
      rng = mulberry32(seed);
      drawAll(false);
      renderOut();
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="rpMode"]'), function (r) {
      r.addEventListener("change", renderOut);
    });

    fetchLib();
  });

  function fetchLib() {
    els.load.textContent = tt("loading");
    fetch("/data/random-prompts.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        data = (json && Array.isArray(json.layers) && json.layers.length) ? json : { layers: [] };
        var n = 0;
        data.layers.forEach(function (L) { n += (L.items || []).length; });
        els.load.textContent = tt("loaded", { n: n });
        initFromUrl();
        renderRows();
        drawAll(false);
        syncSeed();
        renderOut();
      })
      .catch(function () {
        els.load.textContent = tt("loadFail");
      });
  }

  function initFromUrl() {
    var m = /[?&]seed=(\d+)/.exec(location.search);
    seed = m ? (parseInt(m[1], 10) >>> 0) : ((Math.random() * 0x100000000) >>> 0);
    rng = mulberry32(seed);
    picks = data.layers.map(function () { return -1; });
    locks = data.layers.map(function () { return false; });
  }

  function drawAll(force) {
    data.layers.forEach(function (L, i) {
      if (!force && locks[i] && picks[i] >= 0) return;
      picks[i] = weightedPick(L.items);
    });
    renderRows();
  }

  function syncSeed() {
    els.seed.value = String(seed);
    try { history.replaceState(null, "", location.pathname + "?seed=" + seed); } catch (e) { /* ignore */ }
  }

  function renderRows() {
    var lang = document.documentElement.lang === "en" ? "en" : "zh";
    els.layers.textContent = "";
    data.layers.forEach(function (L, i) {
      var row = document.createElement("div");
      row.className = "rp-row" + (locks[i] ? " locked" : "");

      var lab = document.createElement("span");
      lab.className = "rp-lab";
      lab.textContent = (L.label && L.label[lang]) || L.id;

      var it = L.items[picks[i]] || L.items[0];
      var chip = document.createElement("span");
      chip.className = "rp-chip";
      var meaning = document.createElement("span");
      meaning.className = "rp-mean";
      meaning.textContent = (it.label && it.label[lang]) || "";
      var code = document.createElement("code");
      code.textContent = it.text;
      chip.appendChild(meaning);
      chip.appendChild(code);

      var lock = document.createElement("button");
      lock.type = "button";
      lock.className = "btn ghost rp-lock";
      lock.textContent = tt(locks[i] ? "locked" : "lock");
      lock.addEventListener("click", function () {
        locks[i] = !locks[i];
        renderRows();
      });

      var re = document.createElement("button");
      re.type = "button";
      re.className = "btn ghost rp-reroll";
      re.textContent = tt("reroll");
      re.addEventListener("click", function () {
        picks[i] = weightedPick(L.items);
        renderRows();
        renderOut();
      });

      row.appendChild(lab);
      row.appendChild(chip);
      row.appendChild(lock);
      row.appendChild(re);
      els.layers.appendChild(row);
    });
  }

  function renderOut() {
    var texts = [];
    data.layers.forEach(function (L, i) {
      var it = L.items[picks[i]] || L.items[0];
      texts.push(mode() === "nl" ? it.nl : it.text);
    });
    els.out.value = texts.join(", ");
    var ct = PromptLib.countTokens(els.out.value, { vocab: "clip" });
    els.stat.textContent = tt("stat", { n: texts.length, t: ct.total });
  }

  function copyText(s, okKey) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).then(function () {
        Toolkit.toast(tt(okKey));
      }).catch(function () {
        legacyCopy(s, okKey);
      });
    } else {
      legacyCopy(s, okKey);
    }
  }

  function legacyCopy(s, okKey) {
    var ta = document.createElement("textarea");
    ta.value = s;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    Toolkit.toast(tt(ok ? okKey : "copyFail"));
  }
})();
