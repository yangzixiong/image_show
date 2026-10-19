"use strict";
/**
 * 直方图工具。
 *
 * 两种数据源：
 *   普通图片（JPG/PNG/WebP/…） → 统计 R/G/B/亮度 四条 256 桶曲线
 *   16bit TIFF 深度图           → 统计有效深度值在 [min, max] 上的 256 桶分布，并单列无效值(0)
 *
 * 大图会按步长采样（上限 200 万样本），既够准确又不会卡住主线程。
 */
(function () {
  var state = { img: null, stats: null, mode: "overlay", log: false };
  var els = {};

  function $(id) { return document.getElementById(id); }

  document.addEventListener("DOMContentLoaded", function () {
    els.canvas = $("histCanvas");
    els.box = els.canvas.parentNode;
    els.dropzone = $("dropzone");
    els.input = $("fileInput");
    els.mode = $("modeSelect");
    els.log = $("logCheck");
    els.stats = $("stats");

    Toolkit.bindDrop(els.dropzone, els.input, onFiles);
    els.mode.addEventListener("change", function () {
      state.mode = els.mode.value;
      draw();
    });
    els.log.addEventListener("change", function () {
      state.log = els.log.checked;
      draw();
    });

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { if (state.stats) draw(); });
      ro.observe(els.box);
    }
    drawEmpty();
  });

  function onFiles(list) {
    var f = Toolkit.pickFile(list);
    if (!f) { Toolkit.toast(t("tool.noImage")); return; }
    Decoder.decode(f).then(function (img) {
      state.img = img;
      state.stats = analyze(img);
      if (img.kind === "depth") {
        // 深度图只有一条通道，RGB 模式没有意义
        els.mode.disabled = true;
        els.mode.value = "luma";
        state.mode = "luma";
      } else {
        els.mode.disabled = false;
        state.mode = "overlay";
        els.mode.value = "overlay";
      }
      renderStats();
      draw();
    }).catch(function () {
      Toolkit.toast(t("tool.decodeFail", { name: f.name }));
    });
  }

  // ---------- 统计 ----------

  function analyze(img) {
    var n = img.width * img.height;
    var step = Math.max(1, Math.ceil(Math.sqrt(n / 2000000)));
    var i, o;

    if (img.kind === "depth") {
      var bins = new Float64Array(256);
      var span = img.dmax - img.dmin;
      if (!(span > 0)) span = 1;
      var valid = 0, invalid = 0, sum = 0, d, b;
      for (i = 0; i < n; i += step) {
        d = img.depth[i];
        if (d === 0) { invalid += step; continue; }
        valid += step;
        sum += d;
        b = Math.floor((d - img.dmin) / span * 255);
        if (b < 0) b = 0;
        if (b > 255) b = 255;
        bins[b] += step;
      }
      invalid = Math.min(invalid, n - valid);
      return {
        kind: "depth", bins: bins, step: step,
        valid: valid, invalid: invalid,
        mean: valid ? sum / valid : 0,
        dmin: img.dmin, dmax: img.dmax
      };
    }

    var r = new Float64Array(256), g = new Float64Array(256);
    var bl = new Float64Array(256), l = new Float64Array(256);
    var R, G, B, Y;
    for (i = 0; i < n; i += step) {
      o = i * 4;
      R = img.rgba[o]; G = img.rgba[o + 1]; B = img.rgba[o + 2];
      r[R] += step;
      g[G] += step;
      bl[B] += step;
      Y = (0.2126 * R + 0.7152 * G + 0.0722 * B) | 0;
      if (Y > 255) Y = 255;
      l[Y] += step;
    }

    var totalL = 0, sumL = 0, low = 0, high = 0;
    for (i = 0; i < 256; i++) {
      totalL += l[i];
      sumL += l[i] * i;
      if (i <= 4) low += l[i];
      if (i >= 251) high += l[i];
    }

    return {
      kind: "color", r: r, g: g, b: bl, l: l, step: step, totalL: totalL,
      mean: totalL ? sumL / totalL : 0,
      clipLow: totalL ? low / totalL * 100 : 0,
      clipHigh: totalL ? high / totalL * 100 : 0
    };
  }

  // ---------- 绘制 ----------

  function setup(cssH) {
    var cssW = Math.max(300, Math.min(els.box.clientWidth - 24, 1100));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    els.canvas.style.width = cssW + "px";
    els.canvas.style.height = cssH + "px";
    els.canvas.width = Math.round(cssW * dpr);
    els.canvas.height = Math.round(cssH * dpr);
    var ctx = els.canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.__w = cssW;
    ctx.__h = cssH;
    return ctx;
  }

  function drawEmpty() {
    var ctx = setup(260);
    var W = ctx.__w, H = ctx.__h;
    ctx.fillStyle = "#0a0c0f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#5a6474";
    ctx.font = "13px 'Segoe UI', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t("hist.empty"), W / 2, H / 2);
  }

  function draw() {
    if (!state.stats) { drawEmpty(); return; }
    if (state.stats.kind === "depth") drawDepth(state.stats);
    else drawColor(state.stats);
  }

  function panel(ctx, x, y, w, h, arrs, colors, overlay) {
    var max = 1, k, i;
    for (k = 0; k < arrs.length; k++) {
      for (i = 0; i < 256; i++) if (arrs[k][i] > max) max = arrs[k][i];
    }

    ctx.fillStyle = "rgba(255,255,255,.02)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.06)";
    ctx.lineWidth = 1;
    for (var gv = 1; gv < 4; gv++) {
      var gy = Math.round(y + h * gv / 4) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (overlay) ctx.globalCompositeOperation = "lighter";

    for (k = 0; k < arrs.length; k++) {
      var arr = arrs[k];
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      for (i = 0; i < 256; i++) {
        var px = x + (i / 255) * w;
        var t2 = state.log ? Math.log(1 + arr[i]) / Math.log(1 + max) : arr[i] / max;
        ctx.lineTo(px, y + h - t2 * h);
      }
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fillStyle = colors[k];
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawColor(s) {
    var separate = state.mode === "separate";
    var ctx = setup(separate ? 360 : 300);
    var W = ctx.__w, H = ctx.__h;
    ctx.fillStyle = "#0a0c0f";
    ctx.fillRect(0, 0, W, H);

    var padL = 10, padR = 10, padT = 12, padB = 22;
    var plotW = W - padL - padR, plotH = H - padT - padB;

    if (separate) {
      var gap = 8, ph = (plotH - gap * 2) / 3;
      var chans = [
        [s.r, "rgba(255,110,110,.9)", "R"],
        [s.g, "rgba(103,213,161,.9)", "G"],
        [s.b, "rgba(110,150,255,.9)", "B"]
      ];
      for (var i = 0; i < 3; i++) {
        var top = padT + i * (ph + gap);
        panel(ctx, padL, top, plotW, ph, [chans[i][0]], [chans[i][1]], false);
        ctx.fillStyle = "#8a94a3";
        ctx.font = "11px Consolas, monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(chans[i][2], padL + 6, top + 4);
      }
    } else if (state.mode === "luma") {
      panel(ctx, padL, padT, plotW, plotH, [s.l], ["rgba(213,219,228,.85)"], false);
    } else {
      panel(ctx, padL, padT, plotW, plotH, [s.r, s.g, s.b],
        ["rgba(255,90,90,.62)", "rgba(90,210,140,.62)", "rgba(90,140,255,.62)"], true);
    }

    axis(ctx, padL, padT + plotH, plotW);
  }

  function axis(ctx, x, y, w) {
    ctx.fillStyle = "#5a6474";
    ctx.font = "11px Consolas, monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("0", x, y + 5);
    ctx.textAlign = "center";
    ctx.fillText("128", x + w / 2, y + 5);
    ctx.textAlign = "right";
    ctx.fillText("255", x + w, y + 5);
  }

  function drawDepth(s) {
    var ctx = setup(300);
    var W = ctx.__w, H = ctx.__h;
    ctx.fillStyle = "#0a0c0f";
    ctx.fillRect(0, 0, W, H);

    var padL = 10, padR = 10, padT = 12, padB = 24;
    panel(ctx, padL, padT, W - padL - padR, H - padT - padB,
      [s.bins], ["rgba(103,213,161,.75)"], false);

    ctx.fillStyle = "#5a6474";
    ctx.font = "11px Consolas, monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(Decoder.fmtDepth(s.dmin) + " mm", padL, H - padB + 5);
    ctx.textAlign = "right";
    ctx.fillText(Decoder.fmtDepth(s.dmax) + " mm", W - padR, H - padB + 5);
  }

  // ---------- 侧栏数字 ----------

  function line(s) { return "<div>" + s + "</div>"; }

  function renderStats() {
    var s = state.stats, img = state.img, html = "";
    html += line(t("hist.size", { w: img.width, h: img.height }));
    if (s.kind === "depth") {
      html += line(t("hist.depthValid", { n: s.valid.toLocaleString() }));
      html += line(t("hist.depthInvalid", { n: s.invalid.toLocaleString() }));
      html += line(t("hist.depthRange", {
        min: Decoder.fmtDepth(s.dmin), max: Decoder.fmtDepth(s.dmax)
      }));
      html += line(t("hist.depthMean", { v: Decoder.fmtDepth(s.mean) }));
    } else {
      html += line(t("hist.samples", { n: s.totalL.toLocaleString() }));
      html += line(t("hist.mean", { v: s.mean.toFixed(1) }));
      html += line(t("hist.clipLow", { p: s.clipLow.toFixed(2) }));
      html += line(t("hist.clipHigh", { p: s.clipHigh.toFixed(2) }));
    }
    els.stats.innerHTML = html;
  }
})();
