"use strict";
/**
 * 工具页共用的小工具（直方图 / 翻转旋转）。
 *
 * 只放与具体功能无关的东西：文件筛选、拖放绑定、下载、体积格式化、toast。
 * 图片解码一律交给 js/decoder.js（它已经处理了 16bit TIFF 和 EXIF 方向）。
 */
var Toolkit = (function () {

  function isImageFile(f) {
    return (f.type && f.type.indexOf("image/") === 0) || /\.tiff?$/i.test(f.name);
  }

  function pickFile(fileList) {
    var files = Array.prototype.filter.call(fileList, isImageFile);
    return files.length ? files[0] : null;
  }

  /** 拖放、点选、Ctrl+V 粘贴三合一 */
  function bindDrop(zone, input, onFile) {
    zone.addEventListener("dragover", function (e) {
      e.preventDefault();
      zone.classList.add("over");
    });
    zone.addEventListener("dragleave", function () {
      zone.classList.remove("over");
    });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      zone.classList.remove("over");
      if (e.dataTransfer && e.dataTransfer.files.length) onFile(e.dataTransfer.files);
    });
    input.addEventListener("change", function () {
      if (input.files.length) onFile(input.files);
      input.value = "";
    });

    // 拖到页面其他位置时，别让浏览器直接打开图片把当前页面顶掉
    window.addEventListener("dragover", function (e) { e.preventDefault(); });
    window.addEventListener("drop", function (e) { e.preventDefault(); });

    document.addEventListener("paste", function (e) {
      if (e.clipboardData && e.clipboardData.files.length) onFile(e.clipboardData.files);
    });
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 立刻 revoke 会让部分浏览器拿不到数据，延迟释放
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  }

  function baseName(name) {
    return name.replace(/\.[^.]+$/, "");
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }

  return {
    isImageFile: isImageFile,
    pickFile: pickFile,
    bindDrop: bindDrop,
    download: download,
    fmtBytes: fmtBytes,
    baseName: baseName,
    toast: toast
  };
})();
