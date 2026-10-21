"use strict";
var Viewer = (function () {
  var canvas, ctx, stage;
  var dpr = 1, cssW = 0, cssH = 0;
  var img = null;
  var view = { scale: 1, x: 0, y: 0 };
  var checker = null;
  var cb = {};
  var drag = null;

  function init(canvasEl, stageEl, callbacks) {
    canvas = canvasEl; stage = stageEl; cb = callbacks || {};
    ctx = canvas.getContext("2d");

    var c = document.createElement("canvas");
    c.width = c.height = 16;
    var cc = c.getContext("2d");
    cc.fillStyle = "#14171d"; cc.fillRect(0, 0, 16, 16);
    cc.fillStyle = "#1b202a"; cc.fillRect(0, 0, 8, 8); cc.fillRect(8, 8, 8, 8);
    checker = ctx.createPattern(c, "repeat");

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("dblclick", fit);
    window.addEventListener("resize", resize);
    // 舞台尺寸不只随窗口变化：页脚展开、侧栏折叠也会改高度。
    // 不跟着重测就会让画布位图与显示框比例不一致（画面被拉伸，取色坐标也偏）。
    if (typeof ResizeObserver === "function") {
      var ro = new ResizeObserver(function () { resize(); });
      ro.observe(stage);
    }
    resize();
  }

  function resize() {
    var r = stage.getBoundingClientRect();
    var nw = Math.max(1, Math.round(r.width));
    var nh = Math.max(1, Math.round(r.height));
    view.x += (nw - cssW) / 2;
    view.y += (nh - cssH) / 2;
    cssW = nw; cssH = nh;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    draw();
  }

  function setImage(image, keepView) {
    img = image;
    if (keepView) draw();
    else fit();
  }

  function fit() {
    if (!img) { draw(); return; }
    var s = Math.min(cssW / img.width, cssH / img.height) * 0.95;
    if (!(s > 0) || !isFinite(s)) s = 1;
    view.scale = s;
    view.x = (cssW - img.width * s) / 2;
    view.y = (cssH - img.height * s) / 2;
    draw();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0a0c0f";
    ctx.fillRect(0, 0, cssW, cssH);
    if (img) {
      var w = img.width * view.scale, h = img.height * view.scale;
      ctx.fillStyle = checker;
      ctx.fillRect(view.x, view.y, w, h);
      ctx.imageSmoothingEnabled = view.scale < 1;
      ctx.drawImage(img.canvas, view.x, view.y, w, h);
      if (view.scale >= 14) drawGrid(w, h);
    }
    if (cb.onRender) cb.onRender(view.scale);
  }

  function drawGrid(w, h) {
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    var i, p;
    var i0 = Math.max(0, Math.floor((0 - view.x) / view.scale));
    var i1 = Math.min(img.width, Math.ceil((cssW - view.x) / view.scale));
    for (i = i0; i <= i1; i++) {
      p = Math.round(view.x + i * view.scale) + 0.5;
      ctx.moveTo(p, Math.max(view.y, 0));
      ctx.lineTo(p, Math.min(view.y + h, cssH));
    }
    var j0 = Math.max(0, Math.floor((0 - view.y) / view.scale));
    var j1 = Math.min(img.height, Math.ceil((cssH - view.y) / view.scale));
    for (i = j0; i <= j1; i++) {
      p = Math.round(view.y + i * view.scale) + 0.5;
      ctx.moveTo(Math.max(view.x, 0), p);
      ctx.lineTo(Math.min(view.x + w, cssW), p);
    }
    ctx.stroke();
  }

  function toImagePx(e) {
    if (!img) return null;
    var r = canvas.getBoundingClientRect();
    var ix = Math.floor((e.clientX - r.left - view.x) / view.scale);
    var iy = Math.floor((e.clientY - r.top - view.y) / view.scale);
    if (ix < 0 || iy < 0 || ix >= img.width || iy >= img.height) return null;
    return { x: ix, y: iy };
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { x: e.clientX, y: e.clientY, sx: view.x, sy: view.y, moved: false };
  }

  function onMouseMove(e) {
    if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 3) {
        drag.moved = true;
        canvas.style.cursor = "grabbing";
        if (cb.onPx) cb.onPx(null, e.clientX, e.clientY);
      }
      if (drag.moved) {
        view.x = drag.sx + dx;
        view.y = drag.sy + dy;
        draw();
      }
      return;
    }
    if (cb.onPx) cb.onPx(toImagePx(e), e.clientX, e.clientY);
  }

  function onMouseUp() {
    setTimeout(function () {
      drag = null;
      canvas.style.cursor = "crosshair";
    }, 0);
  }

  function onMouseLeave() {
    if (cb.onPx) cb.onPx(null);
  }

  function onClick(e) {
    if (drag && drag.moved) return;
    if (cb.onPick) cb.onPick(toImagePx(e));
  }

  function onWheel(e) {
    e.preventDefault();
    if (!img) return;
    var r = canvas.getBoundingClientRect();
    var px = e.clientX - r.left, py = e.clientY - r.top;
    var f = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    var ns = Math.min(64, Math.max(0.02, view.scale * f));
    view.x = px - (px - view.x) * (ns / view.scale);
    view.y = py - (py - view.y) * (ns / view.scale);
    view.scale = ns;
    draw();
  }

  return {
    init: init,
    setImage: setImage,
    fit: fit,
    resize: resize,
    getSource: function () { return img ? img.canvas : null; }
  };
})();
