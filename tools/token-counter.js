"use strict";
/**
 * 提示词 Token 计数器（页面逻辑，纯浏览器）。
 *
 * 词表按需 fetch：只在打开本页/切换模型时加载并缓存（data/tok/，全部离线 vendor）。
 * CLIP 按 BREAK 分段、每段上限 77 并标出超限段；T5 上限 512（SentencePiece
 * 词表暂未支持，粗估）；o200k/cl100k 无硬上限、显示总 token。
 * 词表未就绪或加载失败时显示 PromptLib 的粗估（带 ~ 前缀）。
 */
(function () {
  var DICT = {
    zh: {
      loading: "词表加载中…",
      ready: "词表就绪 · 精确计数",
      approx: "词表未就绪 · 显示粗估（≈）",
      loadFail: "词表载入失败 · 显示粗估（≈）",
      t5note: "T5 使用 SentencePiece 分词，词表暂未内置，当前为粗估",
      empty: "输入提示词后开始计数",
      tokens: "{n}",
      approxTokens: "≈{n}",
      limit: "上限 {n}",
      noLimit: "无硬上限",
      remain: "剩余 {n}",
      remainNoLimit: "—",
      segTitle: "分段（每段 ≤ 77）",
      segItem: "第 {i} 段：{n}/{l}",
      segOverflow: "第 {i} 段超限：{n}/{l}，超出 {o} 个",
      totalLabel: "总 token",
      limitLabel: "上限",
      remainLabel: "剩余额度",
      example: "载入示例"
    },
    en: {
      loading: "Loading vocab…",
      ready: "Vocab ready · exact count",
      approx: "Vocab not ready · approximate (≈)",
      loadFail: "Vocab failed to load · approximate (≈)",
      t5note: "T5 uses SentencePiece; its vocab is not bundled yet, so counts are estimates",
      empty: "Type a prompt to start counting",
      tokens: "{n}",
      approxTokens: "≈{n}",
      limit: "limit {n}",
      noLimit: "no hard limit",
      remain: "{n} left",
      remainNoLimit: "—",
      segTitle: "Segments (≤ 77 each)",
      segItem: "Segment {i}: {n}/{l}",
      segOverflow: "Segment {i} overflow: {n}/{l}, over by {o}",
      totalLabel: "Total tokens",
      limitLabel: "Limit",
      remainLabel: "Remaining",
      example: "Load example"
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

  var MODELS = {
    clip: { vocab: "clip", files: ["/data/tok/clip-vocab.json", "/data/tok/clip-merges.txt"], table: null, state: "idle" },
    t5: { vocab: "t5", files: [], table: null, state: "none" },
    o200k: { vocab: "o200k", files: ["/data/tok/o200k_base.tiktoken"], table: null, state: "idle" },
    cl100k: { vocab: "cl100k", files: ["/data/tok/cl100k_base.tiktoken"], table: null, state: "idle" }
  };

  var els = {};

  function $(id) { return document.getElementById(id); }

  function currentModel() {
    return MODELS[els.model.value] || MODELS.clip;
  }

  document.addEventListener("DOMContentLoaded", function () {
    els.model = $("tkModel");
    els.input = $("tkInput");
    els.total = $("tkTotal");
    els.limit = $("tkLimit");
    els.remain = $("tkRemain");
    els.segs = $("tkSegs");
    els.segsTitle = $("tkSegsTitle");
    els.status = $("tkStatus");
    els.example = $("tkExample");

    els.input.addEventListener("input", render);
    els.model.addEventListener("change", function () {
      ensureTable().then(render);
      render();
    });
    els.example.addEventListener("click", function () {
      els.input.value = "masterpiece, best quality, 1girl, long silver hair, smile\nBREAK\nin an enchanted forest, soft lighting, bokeh";
      render();
      ensureTable();
    });

    render();
    ensureTable();
  });

  function ensureTable() {
    var m = currentModel();
    if (m.state === "ready" || m.state === "none") return Promise.resolve();
    if (m.state === "loading") return m.promise;
    if (m.state === "failed") {
      // 失败后不立刻重下（o200k 词表 3.6MB），冷却 30 秒才允许再试
      if (Date.now() - (m.failedAt || 0) < 30000) return Promise.resolve();
      m.state = "none";
    }
    m.state = "loading";
    m.promise = Promise.all(m.files.map(function (url) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return url.slice(-5) === ".json" ? r.json() : r.text();
      });
    })).then(function (parts) {
      m.table = (m.vocab === "clip")
        ? PromptLib.loadClipTable(parts[0], parts[1])
        : PromptLib.loadTiktokenTable(parts[0]);
      m.state = "ready";
    }).catch(function () {
      m.state = "failed";
      m.failedAt = Date.now();
      m.table = null;
    });
    return m.promise;
  }

  function render() {
    var m = currentModel();
    var text = els.input.value;
    var ct = PromptLib.countTokens(text, { vocab: m.vocab, table: m.table });
    var exact = m.state === "ready";

    els.total.textContent = text.trim()
      ? (exact ? tt("tokens", { n: ct.total }) : tt("approxTokens", { n: ct.total }))
      : tt("empty");

    els.limit.textContent = ct.limit != null ? tt("limit", { n: ct.limit }) : tt("noLimit");
    if (ct.limit == null) {
      els.remain.textContent = tt("remainNoLimit");
    } else if (m.vocab === "clip") {
      // CLIP 是分段计数：额度看最满的那一段，不是全部相加
      var worst = ct.segmentCounts && ct.segmentCounts.length
        ? Math.max.apply(null, ct.segmentCounts)
        : 0;
      els.remain.textContent = tt("remain", { n: Math.max(0, ct.limit - worst) });
    } else {
      els.remain.textContent = tt("remain", { n: Math.max(0, ct.limit - ct.total) });
    }

    renderSegs(ct, m);

    if (m.vocab === "t5") {
      els.status.textContent = tt("t5note");
    } else if (m.state === "loading") {
      els.status.textContent = tt("loading");
    } else if (m.state === "ready") {
      els.status.textContent = tt("ready");
    } else if (m.state === "failed") {
      els.status.textContent = tt("loadFail");
    } else {
      els.status.textContent = tt("approx");
    }
  }

  function renderSegs(ct, m) {
    els.segs.textContent = "";
    if (m.vocab !== "clip") {
      els.segsTitle.hidden = true;
      return;
    }
    els.segsTitle.hidden = false;
    els.segsTitle.textContent = tt("segTitle");
    var overflow = ct.overflowSegments || [];
    ct.segmentCounts.forEach(function (n, i) {
      var over = overflow.indexOf(i) >= 0;
      var row = document.createElement("div");
      row.className = "tk-seg" + (over ? " over" : "");
      row.textContent = over
        ? tt("segOverflow", { i: i + 1, n: n, l: ct.limit, o: n - ct.limit })
        : tt("segItem", { i: i + 1, n: n, l: ct.limit });
      els.segs.appendChild(row);
    });
  }
})();
