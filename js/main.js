"use strict";
(function () {
  var images = [];
  var current = -1;
  var els = {};

  function $(id) { return document.getElementById(id); }

  function init() {
    els.imgName = $("imgName");
    els.thumbList = $("thumbList");
    els.depthPanel = $("depthPanel");
    els.depthRange = $("depthRange");
    els.cmapSelect = $("cmapSelect");
    els.fileInput = $("fileInput");
    els.stZoom = $("stZoom");
    els.stSize = $("stSize");
    els.stPos = $("stPos");

    Viewer.init($("viewCanvas"), $("stage"), {
      onPx: onHover,
      onPick: onPick,
      onRender: function (s) {
        els.stZoom.textContent = current >= 0 ? Math.round(s * 100) + "%" : "-";
      }
    });
    Inspector.init({ stage: $("stage"), getSource: Viewer.getSource });
    Picker.init({ toast: toast });

    $("btnOpen").addEventListener("click", function () { els.fileInput.click(); });
    els.fileInput.addEventListener("change", function (e) {
      addFiles(e.target.files);
      els.fileInput.value = "";
    });
    els.cmapSelect.addEventListener("change", function () { applyCmap(this.value); });

    window.addEventListener("dragover", function (e) {
      e.preventDefault();
      document.body.classList.add("dragging");
    });
    window.addEventListener("dragleave", function (e) {
      if (!e.relatedTarget) document.body.classList.remove("dragging");
    });
    window.addEventListener("drop", function (e) {
      e.preventDefault();
      document.body.classList.remove("dragging");
      if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });
    document.addEventListener("paste", function (e) {
      if (e.clipboardData && e.clipboardData.files.length) addFiles(e.clipboardData.files);
    });
  }

  function isImageFile(f) {
    return (f.type && f.type.indexOf("image/") === 0) || /\.tiff?$/i.test(f.name);
  }

  function addFiles(fileList) {
    var files = Array.prototype.filter.call(fileList, isImageFile);
    if (!files.length) { toast(t("toast.noFiles")); return; }
    var firstNew = images.length;
    var done = 0;
    files.forEach(function (f) {
      Decoder.decode(f)
        .then(function (img) { images.push(img); })
        .catch(function () { toast(t("toast.decodeFail", { name: f.name })); })
        .then(function () {
          done++;
          if (done === files.length) {
            renderThumbs();
            show(firstNew);
          }
        });
    });
  }

  function makeThumb(img) {
    var t = document.createElement("canvas");
    t.width = 72; t.height = 72;
    var c = t.getContext("2d");
    var s = Math.min(72 / img.width, 72 / img.height);
    var w = img.width * s, h = img.height * s;
    c.fillStyle = "#0a0c0f";
    c.fillRect(0, 0, 72, 72);
    c.drawImage(img.canvas, (72 - w) / 2, (72 - h) / 2, w, h);
    return t;
  }

  function renderThumbs() {
    els.thumbList.innerHTML = "";
    if (!images.length) {
      var d = document.createElement("div");
      d.className = "hint-muted";
      d.textContent = t("ui.noImages");
      els.thumbList.appendChild(d);
      return;
    }
    images.forEach(function (img, i) {
      var b = document.createElement("button");
      b.className = "thumb" + (i === current ? " active" : "");
      b.title = img.name;
      b.appendChild(makeThumb(img));
      b.addEventListener("click", function () { show(i); });
      els.thumbList.appendChild(b);
    });
  }

  function show(i) {
    if (i < 0 || i >= images.length) return;
    current = i;
    var img = images[i];
    Viewer.setImage(img);
    document.body.classList.remove("no-img");
    els.imgName.textContent = img.name + (img.kind === "depth" ? t("label.depthImage") : "");
    els.stSize.textContent = img.width + " × " + img.height + (img.kind === "depth" ? t("label.depth16") : "");
    var isDepth = img.kind === "depth";
    els.depthPanel.hidden = !isDepth;
    if (isDepth) {
      els.depthRange.textContent = t("label.range", {
        min: Decoder.fmtDepth(img.dmin),
        max: Decoder.fmtDepth(img.dmax)
      }) + (img.hasZero ? t("label.zeroInvalid") : "");
      els.cmapSelect.value = img.cmap;
    }
    Inspector.clear();
    els.stPos.textContent = "";
    renderThumbs();
  }

  function applyCmap(name) {
    var img = images[current];
    if (!img || img.kind !== "depth") return;
    Decoder.applyCmap(img, name);
    Viewer.setImage(img, true);
  }

  function onHover(p, clientX, clientY) {
    var img = images[current];
    if (!img || !p) {
      Inspector.clear();
      els.stPos.textContent = "";
      return;
    }
    Inspector.update(img, p, clientX, clientY);
    els.stPos.textContent = "X: " + p.x + "  Y: " + p.y;
  }

  function onPick(p) {
    if (p) Picker.pick(images[current], p);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
