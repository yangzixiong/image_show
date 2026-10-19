"use strict";
/**
 * 翻转 / 旋转 / 镜像工具。
 *
 * 变换用「旋转角度 + 两个翻转标志」描述，渲染时一次性画到 canvas：
 *   先旋转，再缩放镜像，最后把原图居中画出来。
 * 导出直接读 canvas，所以不残留 EXIF 方向标记（原图方向已由 Decoder 摆正）。
 */
(function () {
  var state = { img: null, rot: 0, fh: false, fv: false };
  var els = {};

  function $(id) { return document.getElementById(id); }

  document.addEventListener("DOMContentLoaded", function () {
    els.canvas = $("flipCanvas");
    els.out = $("outSize");
    els.dropzone = $("dropzone");
    els.input = $("fileInput");
    els.format = $("formatSelect");
    els.quality = $("qualityRange");
    els.qualityVal = $("qualityVal");
    els.btnDownload = $("btnDownload");

    Toolkit.bindDrop(els.dropzone, els.input, onFiles);

    $("btnRotL").addEventListener("click", function () {
      state.rot = (state.rot + 3) % 4;
      render();
    });
    $("btnRotR").addEventListener("click", function () {
      state.rot = (state.rot + 1) % 4;
      render();
    });
    $("btnFlipH").addEventListener("click", function () {
      state.fh = !state.fh;
      render();
    });
    $("btnFlipV").addEventListener("click", function () {
      state.fv = !state.fv;
      render();
    });
    $("btnReset").addEventListener("click", function () {
      state.rot = 0;
      state.fh = false;
      state.fv = false;
      render();
    });

    els.format.addEventListener("change", syncQuality);
    els.quality.addEventListener("input", function () {
      els.qualityVal.textContent = Math.round(els.quality.value * 100) + "%";
    });
    els.btnDownload.addEventListener("click", download);
    syncQuality();
  });

  function onFiles(list) {
    var f = Toolkit.pickFile(list);
    if (!f) { Toolkit.toast(t("tool.noImage")); return; }
    Decoder.decode(f).then(function (img) {
      state.img = img;
      state.rot = 0;
      state.fh = false;
      state.fv = false;
      els.dropzone.hidden = true;
      render();
    }).catch(function () {
      Toolkit.toast(t("tool.decodeFail", { name: f.name }));
    });
  }

  function render() {
    if (!state.img) {
      els.out.textContent = "";
      return;
    }
    var img = state.img;
    var swap = state.rot % 2 === 1;
    var w = swap ? img.height : img.width;
    var h = swap ? img.width : img.height;

    els.canvas.width = w;
    els.canvas.height = h;
    var ctx = els.canvas.getContext("2d");
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(state.rot * Math.PI / 2);
    ctx.scale(state.fh ? -1 : 1, state.fv ? -1 : 1);
    ctx.drawImage(img.canvas, -img.width / 2, -img.height / 2);
    ctx.restore();

    els.out.textContent = t("flip.outSize", { w: w, h: h });
  }

  function syncQuality() {
    var lossy = els.format.value !== "png";
    els.quality.disabled = !lossy;
    els.qualityVal.textContent = Math.round(els.quality.value * 100) + "%";
    els.quality.parentNode.style.opacity = lossy ? "1" : ".45";
  }

  function download() {
    if (!state.img) { Toolkit.toast(t("tool.noImage")); return; }
    var fmt = els.format.value;
    var q = parseFloat(els.quality.value);
    var source = els.canvas;

    if (fmt === "jpeg") {
      // JPEG 没有透明通道，先铺白底，否则透明区域会变黑
      var flat = document.createElement("canvas");
      flat.width = source.width;
      flat.height = source.height;
      var fx = flat.getContext("2d");
      fx.fillStyle = "#ffffff";
      fx.fillRect(0, 0, flat.width, flat.height);
      fx.drawImage(source, 0, 0);
      source = flat;
    }

    source.toBlob(function (blob) {
      if (!blob) { Toolkit.toast(t("tool.decodeFail", { name: state.img.name })); return; }
      var name = Toolkit.baseName(state.img.name) + "." + fmt;
      Toolkit.download(blob, name);
      Toolkit.toast(t("flip.downloaded", {
        name: name,
        size: Toolkit.fmtBytes(blob.size)
      }));
    }, "image/" + fmt, q);
  }
})();
