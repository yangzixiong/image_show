"use strict";
/**
 * 图片网格分割工具。
 *
 * 把图片切成 rows × cols 块：块的边界用 floor(i * W / n) 计算，不重叠、不丢像素，
 * 边缘块自动吸收除不尽的余数。逐块 canvas → PNG，再用 fflate.zipSync 打包
 * （PNG 本身已压缩，zip 用 level 0 只做容器不再二次压缩）。
 */
(function () {
  var DICT = {
    zh: {
      noImage: "尚未载入图片",
      decodeFail: "无法解码 {name}",
      cellInfo: "每块约 {w} × {h} · 共 {n} 块",
      packing: "正在打包 {n} 块…",
      downloaded: "已导出 {name}（{size}）"
    },
    en: {
      noImage: "No image loaded yet",
      decodeFail: "Could not decode {name}",
      cellInfo: "≈{w} × {h} per tile · {n} tiles",
      packing: "Packing {n} tiles…",
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

  var state = { img: null, rows: 3, cols: 3 };
  var els = {};

  function $(id) { return document.getElementById(id); }

  document.addEventListener("DOMContentLoaded", function () {
    els.wrap = $("gridWrap");
    els.dropzone = $("dropzone");
    els.input = $("fileInput");
    els.rows = $("rowSel");
    els.cols = $("colSel");
    els.info = $("gridInfo");
    els.btnDownload = $("btnDownload");

    Toolkit.bindDrop(els.dropzone, els.input, onFiles);

    var onGrid = function () {
      state.rows = parseInt(els.rows.value, 10);
      state.cols = parseInt(els.cols.value, 10);
      render();
    };
    els.rows.addEventListener("change", onGrid);
    els.cols.addEventListener("change", onGrid);

    Array.prototype.forEach.call(document.querySelectorAll(".grid-chip"), function (chip) {
      chip.addEventListener("click", function () {
        var rc = chip.getAttribute("data-grid").split("x");
        els.rows.value = rc[0];
        els.cols.value = rc[1];
        onGrid();
      });
    });

    els.btnDownload.addEventListener("click", download);
    updateInfo();
  });

  function onFiles(list) {
    var f = Toolkit.pickFile(list);
    if (!f) { Toolkit.toast(tt("noImage")); return; }
    Decoder.decode(f).then(function (img) {
      state.img = img;
      els.dropzone.hidden = true;
      render();
    }).catch(function () {
      Toolkit.toast(tt("decodeFail", { name: f.name }));
    });
  }

  function render() {
    if (!state.img) { updateInfo(); return; }
    var img = state.img;
    var rows = state.rows, cols = state.cols;

    els.wrap.innerHTML = "";
    els.wrap.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var b = cellBounds(img, r, c, rows, cols);
        var cv = document.createElement("canvas");
        cv.width = b.w; cv.height = b.h;
        cv.getContext("2d").drawImage(img.canvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
        els.wrap.appendChild(cv);
      }
    }
    updateInfo();
  }

  function cellBounds(img, r, c, rows, cols) {
    var x0 = Math.floor(c * img.width / cols), x1 = Math.floor((c + 1) * img.width / cols);
    var y0 = Math.floor(r * img.height / rows), y1 = Math.floor((r + 1) * img.height / rows);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function updateInfo() {
    if (!state.img) { els.info.textContent = tt("noImage"); return; }
    var b = cellBounds(state.img, 0, 0, state.rows, state.cols);
    els.info.textContent = tt("cellInfo", {
      w: b.w, h: b.h, n: state.rows * state.cols
    });
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        blob ? resolve(blob) : reject(new Error("toBlob failed"));
      }, "image/png");
    });
  }

  function download() {
    if (!state.img) { Toolkit.toast(tt("noImage")); return; }
    var img = state.img;
    var rows = state.rows, cols = state.cols;
    var base = Toolkit.baseName(img.name);
    var btn = els.btnDownload;

    btn.disabled = true;
    Toolkit.toast(tt("packing", { n: rows * cols }));

    var files = {};
    var chain = Promise.resolve();

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        (function (r, c) {
          chain = chain.then(function () {
            var b = cellBounds(img, r, c, rows, cols);
            var cv = document.createElement("canvas");
            cv.width = b.w; cv.height = b.h;
            cv.getContext("2d").drawImage(img.canvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
            return toBlob(cv).then(function (blob) {
              return blob.arrayBuffer();
            }).then(function (buf) {
              files[base + "_r" + (r + 1) + "c" + (c + 1) + ".png"] = new Uint8Array(buf);
            });
          });
        })(r, c);
      }
    }

    chain.then(function () {
      var zipped = fflate.zipSync(files, { level: 0 });
      var blob = new Blob([zipped], { type: "application/zip" });
      var name = base + "_grid_" + rows + "x" + cols + ".zip";
      Toolkit.download(blob, name);
      Toolkit.toast(tt("downloaded", { name: name, size: Toolkit.fmtBytes(blob.size) }));
    }).catch(function () {
      Toolkit.toast(tt("decodeFail", { name: img.name }));
    }).finally(function () {
      btn.disabled = false;
    });
  }
})();
