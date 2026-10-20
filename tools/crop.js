"use strict";
/**
 * 图片比例裁剪工具。
 *
 * 预览：原图画在 canvas 上，裁剪框是绝对定位的覆盖层（box-shadow 大扩散把框外压暗），
 *       8 个手柄 + 整框拖动都用 Pointer 事件，鼠标和触屏通吃。
 * 导出：按图像原始像素从 Decoder 的 canvas 上取区域，可选长边 512/768/1024 缩放，
 *       PNG 无损；JPEG 先铺白底（无透明通道），WebP 走质量参数。
 */
(function () {
  var DICT = {
    zh: {
      noImage: "尚未载入图片",
      decodeFail: "无法解码 {name}",
      output: "输出：{w} × {h}",
      ratio: "比例：{r}",
      free: "自由",
      downloaded: "已导出 {name}（{size}）"
    },
    en: {
      noImage: "No image loaded yet",
      decodeFail: "Could not decode {name}",
      output: "Output: {w} × {h}",
      ratio: "Ratio: {r}",
      free: "Free",
      downloaded: "Exported {name} ({size})"
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

  var RATIOS = [
    { w: 1, h: 1 }, { w: 4, h: 3 }, { w: 3, h: 4 },
    { w: 16, h: 9 }, { w: 9, h: 16 }, { w: 3, h: 2 }, { w: 2, h: 3 }
  ];

  var state = { img: null, ratio: null, rect: null, dragging: null };
  var els = {};

  function $(id) { return document.getElementById(id); }

  document.addEventListener("DOMContentLoaded", function () {
    els.stage = $("cropStage");
    els.canvas = $("cropCanvas");
    els.box = $("cropBox");
    els.dropzone = $("dropzone");
    els.input = $("fileInput");
    els.out = $("outInfo");
    els.longSide = $("longSide");
    els.format = $("formatSelect");
    els.quality = $("qualityRange");
    els.qualityVal = $("qualityVal");
    els.btnDownload = $("btnDownload");

    Toolkit.bindDrop(els.dropzone, els.input, onFiles);

    var chips = document.querySelectorAll(".ratio-chip");
    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener("click", function () {
        Array.prototype.forEach.call(chips, function (c) { c.classList.remove("on"); });
        chip.classList.add("on");
        var idx = parseInt(chip.getAttribute("data-ratio"), 10);
        state.ratio = isNaN(idx) ? null : RATIOS[idx];
        if (state.img) {
          state.rect = state.ratio ? fitRect(state.ratio) : { x: 0, y: 0, w: state.img.width, h: state.img.height };
          render();
        }
      });
    });

    els.format.addEventListener("change", syncQuality);
    els.quality.addEventListener("input", function () {
      els.qualityVal.textContent = Math.round(els.quality.value * 100) + "%";
    });
    els.longSide.addEventListener("change", function () { updateInfo(); });
    els.btnDownload.addEventListener("click", download);
    bindBoxEvents();
    syncQuality();
    updateInfo();
    window.addEventListener("resize", function () { layoutBox(); });
  });

  function onFiles(list) {
    var f = Toolkit.pickFile(list);
    if (!f) { Toolkit.toast(tt("noImage")); return; }
    Decoder.decode(f).then(function (img) {
      state.img = img;
      state.rect = state.ratio ? fitRect(state.ratio) : { x: 0, y: 0, w: img.width, h: img.height };
      els.dropzone.hidden = true;
      els.canvas.width = img.width;
      els.canvas.height = img.height;
      els.canvas.getContext("2d").drawImage(img.canvas, 0, 0);
      els.box.hidden = false;
      render();
    }).catch(function () {
      Toolkit.toast(tt("decodeFail", { name: f.name }));
    });
  }

  /** 给定比例时，取图内能放下的最大居中矩形 */
  function fitRect(r) {
    var img = state.img;
    var w = img.width, h = Math.round(w * r.h / r.w);
    if (h > img.height) { h = img.height; w = Math.round(h * r.w / r.h); }
    return { x: Math.round((img.width - w) / 2), y: Math.round((img.height - h) / 2), w: w, h: h };
  }

  function render() {
    layoutBox();
    updateInfo();
  }

  function layoutBox() {
    if (!state.img || !state.rect) return;
    var s = els.canvas.clientWidth / els.canvas.width || 1;
    var r = state.rect;
    els.box.style.left = r.x * s + "px";
    els.box.style.top = r.y * s + "px";
    els.box.style.width = r.w * s + "px";
    els.box.style.height = r.h * s + "px";
  }

  function outSize() {
    var r = state.rect;
    if (!r) return { w: 0, h: 0 };
    var long = parseInt(els.longSide.value, 10);
    if (!long) return { w: Math.round(r.w), h: Math.round(r.h) };
    var scale = long / Math.max(r.w, r.h);
    return { w: Math.max(1, Math.round(r.w * scale)), h: Math.max(1, Math.round(r.h * scale)) };
  }

  function updateInfo() {
    if (!state.img) { els.out.textContent = tt("noImage"); return; }
    var o = outSize();
    var r = state.ratio ? state.ratio.w + ":" + state.ratio.h : tt("free");
    els.out.textContent = tt("output", o) + " · " + tt("ratio", { r: r });
  }

  /* ---- 裁剪框拖动 / 手柄缩放（Pointer 事件，鼠标触屏通用） ---- */

  function bindBoxEvents() {
    var start = null;

    function begin(e, mode) {
      if (!state.img || !state.rect) return;
      e.preventDefault();
      var s = els.canvas.clientWidth / els.canvas.width || 1;
      start = {
        mode: mode,
        px: e.clientX, py: e.clientY, scale: s,
        rect: { x: state.rect.x, y: state.rect.y, w: state.rect.w, h: state.rect.h }
      };
      els.box.setPointerCapture(e.pointerId);
    }

    function move(e) {
      if (!start) return;
      e.preventDefault();
      var dx = (e.clientX - start.px) / start.scale;
      var dy = (e.clientY - start.py) / start.scale;
      var img = state.img;
      var r0 = start.rect;
      var r = { x: r0.x, y: r0.y, w: r0.w, h: r0.h };
      var m = start.mode;

      if (m === "move") {
        r.x = r0.x + dx;
        r.y = r0.y + dy;
      } else {
        var right = r0.x + r0.w, bottom = r0.y + r0.h;
        if (m.indexOf("w") > -1) r.x = r0.x + dx;
        if (m.indexOf("n") > -1) r.y = r0.y + dy;
        if (m.indexOf("e") > -1) right = r0.x + r0.w + dx;
        if (m.indexOf("s") > -1) bottom = r0.y + r0.h + dy;
        r.w = right - r.x;
        r.h = bottom - r.y;

        if (state.ratio) {
          // 按比例锁：以拖动幅度更大的轴为准，另一轴按比例推算（锚点是原地对角）
          var k = state.ratio.w / state.ratio.h;
          var anchorX = m.indexOf("w") > -1 ? r0.x + r0.w : r0.x;
          var anchorY = m.indexOf("n") > -1 ? r0.y + r0.h : r0.y;
          var newW = Math.abs(right - anchorX), newH = Math.abs(bottom - anchorY);
          if (newW / k > newH) {
            r.w = m.indexOf("w") > -1 ? -newW : newW;
            r.h = r.w / k;
          } else {
            r.h = m.indexOf("n") > -1 ? -newH : newH;
            r.w = r.h * k;
          }
          r.w = Math.abs(r.w); r.h = Math.abs(r.h);
          r.x = m.indexOf("w") > -1 ? anchorX - r.w : anchorX;
          r.y = m.indexOf("n") > -1 ? anchorY - r.h : anchorY;
        }
      }

      clampRect(r);
      state.rect = normalize(r);
      layoutBox();
      updateInfo();
    }

    function end(e) {
      if (!start) return;
      try { els.box.releasePointerCapture(e.pointerId); } catch (err) { /* 未捕获时忽略 */ }
      start = null;
    }

    els.box.addEventListener("pointerdown", function (e) {
      if (e.target === els.box) begin(e, "move");
    });
    Array.prototype.forEach.call(els.box.querySelectorAll(".hd"), function (hd) {
      hd.addEventListener("pointerdown", function (e) { begin(e, hd.getAttribute("data-dir")); });
    });
    els.box.addEventListener("pointermove", move);
    els.box.addEventListener("pointerup", end);
    els.box.addEventListener("pointercancel", end);
  }

  /** 负宽高（拖过头）转正、越界收回、最小尺寸 */
  function normalize(r) {
    if (r.w < 0) { r.x += r.w; r.w = -r.w; }
    if (r.h < 0) { r.y += r.h; r.h = -r.h; }
    return r;
  }

  function clampRect(r) {
    var img = state.img;
    var min = 8;
    r.w = Math.max(min, Math.min(r.w, img.width));
    r.h = Math.max(min, Math.min(r.h, img.height));
    r.x = Math.max(0, Math.min(r.x, img.width - r.w));
    r.y = Math.max(0, Math.min(r.y, img.height - r.h));
  }

  function syncQuality() {
    var lossy = els.format.value !== "png";
    els.quality.disabled = !lossy;
    els.qualityVal.textContent = Math.round(els.quality.value * 100) + "%";
    els.quality.parentNode.style.opacity = lossy ? "1" : ".45";
  }

  function download() {
    if (!state.img || !state.rect) { Toolkit.toast(tt("noImage")); return; }
    var fmt = els.format.value;
    var q = parseFloat(els.quality.value);
    var o = outSize();
    var r = state.rect;

    var out = document.createElement("canvas");
    out.width = o.w;
    out.height = o.h;
    var ctx = out.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(state.img.canvas, r.x, r.y, r.w, r.h, 0, 0, o.w, o.h);

    var source = out;
    if (fmt === "jpeg") {
      var flat = document.createElement("canvas");
      flat.width = o.w; flat.height = o.h;
      var fx = flat.getContext("2d");
      fx.fillStyle = "#ffffff";
      fx.fillRect(0, 0, o.w, o.h);
      fx.drawImage(out, 0, 0);
      source = flat;
    }

    source.toBlob(function (blob) {
      if (!blob) { Toolkit.toast(tt("decodeFail", { name: state.img.name })); return; }
      var name = Toolkit.baseName(state.img.name) + "." + fmt;
      Toolkit.download(blob, name);
      Toolkit.toast(tt("downloaded", { name: name, size: Toolkit.fmtBytes(blob.size) }));
    }, "image/" + fmt, q);
  }
})();
