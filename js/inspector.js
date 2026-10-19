"use strict";
var Inspector = (function () {
  var els = {}, mag, magCtx, tip, tipSwatch, tipText, stage;
  var getSource = null;
  var MAG_N = 11, CELL = 16;

  function init(opts) {
    els.pos = document.getElementById("posText");
    els.swatch = document.getElementById("swatchBox");
    els.hex = document.getElementById("hexText");
    els.rgb = document.getElementById("rgbText");
    els.depth = document.getElementById("depthText");
    mag = document.getElementById("magCanvas");
    magCtx = mag.getContext("2d");
    tip = document.getElementById("pxTip");
    tipSwatch = document.getElementById("tipSwatch");
    tipText = document.getElementById("tipText");
    stage = opts.stage;
    getSource = opts.getSource;
    clear();
  }

  function clear() {
    els.pos.textContent = t("pos.none");
    els.hex.textContent = "-";
    els.rgb.textContent = t("rgb.none");
    els.swatch.style.backgroundColor = "transparent";
    els.depth.hidden = true;
    tip.classList.remove("show");
    magCtx.fillStyle = "#000";
    magCtx.fillRect(0, 0, mag.width, mag.height);
  }

  function update(img, p, clientX, clientY) {
    if (!img || !p) { clear(); return; }
    var i = (p.y * img.width + p.x) * 4;
    var r = img.rgba[i], g = img.rgba[i + 1], b = img.rgba[i + 2];
    var hex = "#" + to2(r) + to2(g) + to2(b);

    els.pos.textContent = "X: " + p.x + "  Y: " + p.y;
    els.rgb.textContent = t("rgb.values", { r: r, g: g, b: b });
    els.hex.textContent = hex;
    els.swatch.style.backgroundColor = hex;

    var tipStr = hex + "  " + r + "," + g + "," + b;
    if (img.kind === "depth") {
      var d = img.depth[p.y * img.width + p.x];
      var ds = d === 0 ? t("label.invalid") : Decoder.fmtDepth(d) + " mm";
      els.depth.hidden = false;
      els.depth.textContent = t("label.depthValue", { value: ds });
      tipStr = t("tip.depth", { value: ds, hex: hex });
    } else {
      els.depth.hidden = true;
    }

    drawMag(p);
    moveTip(tipStr, hex, clientX, clientY);
  }

  function moveTip(text, hex, clientX, clientY) {
    if (clientX == null) { clear(); return; }
    var r = stage.getBoundingClientRect();
    var x = clientX - r.left + 16;
    var y = clientY - r.top + 18;
    if (x > r.width - 210) x = clientX - r.left - 210;
    if (y > r.height - 40) y = clientY - r.top - 36;
    tip.style.left = Math.max(4, x) + "px";
    tip.style.top = Math.max(4, y) + "px";
    tipText.textContent = text;
    tipSwatch.style.backgroundColor = hex;
    tip.classList.add("show");
  }

  function drawMag(p) {
    magCtx.fillStyle = "#000";
    magCtx.fillRect(0, 0, mag.width, mag.height);
    var s = getSource && getSource();
    if (!s) return;
    var half = (MAG_N - 1) / 2;
    var sx = p.x - half, sy = p.y - half;
    var dx = 0, dy = 0, w = MAG_N, h = MAG_N;
    if (sx < 0) { dx = -sx * CELL; w += sx; sx = 0; }
    if (sy < 0) { dy = -sy * CELL; h += sy; sy = 0; }
    if (sx + w > s.width) w = s.width - sx;
    if (sy + h > s.height) h = s.height - sy;
    if (w <= 0 || h <= 0) return;
    magCtx.imageSmoothingEnabled = false;
    magCtx.drawImage(s, sx, sy, w, h, dx, dy, w * CELL, h * CELL);
    magCtx.strokeStyle = "rgba(255,255,255,0.9)";
    magCtx.lineWidth = 1.5;
    magCtx.strokeRect(half * CELL + 0.75, half * CELL + 0.75, CELL - 1.5, CELL - 1.5);
  }

  function to2(v) { return (v < 16 ? "0" : "") + v.toString(16); }

  return { init: init, update: update, clear: clear };
})();
