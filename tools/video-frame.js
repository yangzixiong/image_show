"use strict";
/**
 * 视频帧提取工具。
 *
 * 视频只交给 <video> 解码，画面经 canvas 取出，全程本地：文件用 blob URL 挂给 video，
 * 没有任何 upload。抓帧靠 seek + requestVideoFrameCallback（老浏览器回退 seeked），
 * 批量导出用 fflate.zipSync 打一个 store 模式的 zip（JPEG/WebP 已压缩，不二次压缩）。
 */
(function () {
  var DICT = {
    zh: {
      noVideo: "先选择一个视频文件",
      notVideo: "这不是视频文件",
      meta: "{name} · {size} · {w}×{h} · {dur}",
      loadFail: "浏览器无法解码这个视频（常见于 HEVC、AV1 或 ProRes），换 MP4（H.264）或 WebM 再试。",
      noTimes: "没有可用的时间点",
      progress: "正在提取 {n} / {total}…",
      done: "完成：{n} 帧",
      grabbed: "已抓取当前帧",
      zipped: "已打包 {n} 帧（{size}）",
      empty: "还没有提取任何帧",
      nothing: "尚未载入视频",
      frames: "帧数：{n}",
      size: "合计：{size}"
    },
    en: {
      noVideo: "Pick a video file first",
      notVideo: "That is not a video file",
      meta: "{name} · {size} · {w}×{h} · {dur}",
      loadFail: "This browser cannot decode the video (often HEVC, AV1 or ProRes). Try MP4 (H.264) or WebM.",
      noTimes: "No valid timestamps",
      progress: "Extracting {n} / {total}…",
      done: "Done: {n} frames",
      grabbed: "Frame captured",
      zipped: "Zipped {n} frames ({size})",
      empty: "No frames extracted yet",
      nothing: "No video loaded",
      frames: "Frames: {n}",
      size: "Total: {size}"
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

  var state = { file: null, url: null, duration: 0, w: 0, h: 0, frames: [], busy: false };
  var els = {};

  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return "--:--";
    var m = Math.floor(sec / 60);
    var s = sec - m * 60;
    return pad(m) + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
  }

  function setStatus(text) {
    els.statStatus.textContent = text;
  }

  function setStats() {
    var bytes = 0;
    state.frames.forEach(function (f) { bytes += f.blob.size; });
    els.statFrames.textContent = tt("frames", { n: state.frames.length });
    els.statSize.textContent = tt("size", { size: Toolkit.fmtBytes(bytes) });
    els.btnZip.disabled = state.frames.length === 0;
  }

  /* ---------------- 载入与解码 ---------------- */

  function isVideo(file) {
    return (file.type && file.type.indexOf("video/") === 0) ||
      /\.(mp4|m4v|webm|mov|ogv|mkv)$/i.test(file.name);
  }

  function onFiles(fileList) {
    var file = fileList && fileList[0];
    if (!file) return;
    if (!isVideo(file)) { Toolkit.toast(tt("notVideo")); return; }

    clearFrames();
    if (state.url) URL.revokeObjectURL(state.url);
    state.file = file;
    state.url = URL.createObjectURL(file);
    state.duration = 0;
    els.warn.hidden = true;
    els.meta.textContent = "";
    els.video.src = state.url;
    els.video.load();
    setStatus(tt("nothing"));
    setStats();
  }

  function onMeta() {
    state.duration = els.video.duration || 0;
    state.w = els.video.videoWidth || 0;
    state.h = els.video.videoHeight || 0;
    if (!state.w || !state.h) return;
    els.meta.textContent = tt("meta", {
      name: state.file ? state.file.name : "",
      size: state.file ? Toolkit.fmtBytes(state.file.size) : "",
      w: state.w,
      h: state.h,
      dur: fmtTime(state.duration)
    });
    els.warn.hidden = true;
  }

  function onVideoError() {
    if (!state.file) return;
    els.warn.hidden = false;
    els.warn.textContent = tt("loadFail");
    els.meta.textContent = "";
  }

  /* ---------------- 抓帧 ---------------- */

  // 目标宽度：选了固定宽度就按比例缩，但不放大原片
  function targetSize() {
    var want = parseInt(els.outWidth.value, 10) || 0;
    var w = state.w;
    if (want && want < state.w) w = want;
    var h = Math.max(1, Math.round(w * (state.h / state.w)));
    return { w: w, h: h };
  }

  function seek(t) {
    return new Promise(function (resolve) {
      var v = els.video;
      if (!state.duration) { resolve(); return; }

      var target = Math.max(0, Math.min(t, state.duration - 0.05));
      var done = false;

      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      }

      var timer = setTimeout(finish, 2000);

      if (typeof v.requestVideoFrameCallback === "function") {
        v.requestVideoFrameCallback(finish);
      } else {
        v.addEventListener("seeked", function once() {
          v.removeEventListener("seeked", once);
          setTimeout(finish, 40);
        });
      }

      try {
        v.currentTime = target;
      } catch (e) {
        finish();
      }
    });
  }

  function grab() {
    var size = targetSize();
    var canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    canvas.getContext("2d").drawImage(els.video, 0, 0, size.w, size.h);

    var type = "image/" + els.format.value;
    var q = parseFloat(els.quality.value) || 0.92;

    return new Promise(function (resolve) {
      if (els.format.value === "png") {
        canvas.toBlob(function (b) { resolve(b); }, type);
      } else {
        canvas.toBlob(function (b) { resolve(b); }, type, q);
      }
    });
  }

  function addFrame(t, blob) {
    var ext = els.format.value === "jpeg" ? "jpg" : els.format.value;
    var idx = state.frames.length + 1;
    state.frames.push({
      t: t,
      blob: blob,
      name: Toolkit.baseName(state.file.name) + "_frame_" + ("000" + idx).slice(-3) + "." + ext,
      url: URL.createObjectURL(blob)
    });
  }

  function clearFrames() {
    state.frames.forEach(function (f) { URL.revokeObjectURL(f.url); });
    state.frames = [];
    els.thumbs.innerHTML = "";
    if (els.statFrames) setStats();
  }

  function renderThumbs() {
    els.thumbs.innerHTML = "";
    state.frames.forEach(function (f, i) {
      var fig = document.createElement("figure");
      var img = document.createElement("img");
      img.src = f.url;
      img.alt = "";
      img.loading = "lazy";
      var cap = document.createElement("figcaption");
      cap.textContent = "#" + (i + 1) + " · " + fmtTime(f.t);
      fig.appendChild(img);
      fig.appendChild(cap);
      els.thumbs.appendChild(fig);
    });
  }

  function planTimes() {
    var cap = Math.max(1, Math.min(200, parseInt(els.maxFrames.value, 10) || 20));
    var mode = els.mode.value;
    var list = [];

    if (mode === "single") {
      list.push(els.video.currentTime || 0);
    } else if (mode === "list") {
      els.timeList.value.split(/[\s,;，、]+/).forEach(function (part) {
        if (!part) return;
        var v = parseFloat(part);
        if (isFinite(v) && v >= 0) list.push(v);
      });
    } else {
      var step = parseFloat(els.interval.value) || 1;
      if (step < 0.05) step = 0.05;
      for (var t = 0; t < state.duration - 0.05 && list.length < cap; t += step) {
        list.push(Math.round(t * 1000) / 1000);
      }
    }

    var seen = {};
    var out = [];
    list.forEach(function (t) {
      var key = t.toFixed(2);
      if (seen[key]) return;
      seen[key] = 1;
      if (state.duration && t >= state.duration) return;
      out.push(t);
    });

    return out.slice(0, cap);
  }

  function setBusy(on) {
    state.busy = on;
    els.btnExtract.disabled = on;
    els.btnSingle.disabled = on;
    els.progressWrap.hidden = !on;
    if (!on) els.progressBar.style.width = "0%";
  }

  function extract() {
    if (state.busy) return;
    if (!state.file || !state.duration) { Toolkit.toast(tt("noVideo")); return; }

    var times = planTimes();
    if (!times.length) { Toolkit.toast(tt("noTimes")); return; }

    var total = times.length;
    var i = 0;

    setBusy(true);
    els.video.pause();

    function step() {
      if (i >= total) {
        setBusy(false);
        setStatus(tt("done", { n: state.frames.length }));
        return;
      }
      var t = times[i];
      i++;
      setStatus(tt("progress", { n: i, total: total }));
      els.progressBar.style.width = Math.round((i / total) * 100) + "%";

      seek(t).then(grab).then(function (blob) {
        if (blob) addFrame(t, blob);
        renderThumbs();
        setStats();
        step();
      });
    }

    step();
  }

  function grabOnce() {
    if (!state.file) { Toolkit.toast(tt("noVideo")); return; }
    var t = els.video.currentTime || 0;
    setBusy(true);
    seek(t).then(grab).then(function (blob) {
      setBusy(false);
      if (!blob) return;
      addFrame(t, blob);
      renderThumbs();
      setStats();
      setStatus(tt("grabbed"));
    });
  }

  function zipAll() {
    if (!state.frames.length) { Toolkit.toast(tt("empty")); return; }
    var frames = state.frames.slice();

    Promise.all(frames.map(function (f) { return f.blob.arrayBuffer(); })).then(async function (bufs) {
      var files = {};
      frames.forEach(function (f, i) { files[f.name] = new Uint8Array(bufs[i]); });

      var ff = await Toolkit.ensureFflate();
      var zipped = ff.zipSync(files, { level: 0 });
      var blob = new Blob([zipped], { type: "application/zip" });
      Toolkit.download(blob, Toolkit.baseName(state.file.name) + "_frames.zip");
      Toolkit.toast(tt("zipped", { n: frames.length, size: Toolkit.fmtBytes(blob.size) }));
    });
  }

  /* ---------------- 绑定 ---------------- */

  document.addEventListener("DOMContentLoaded", function () {
    els.dropzone = $("dropzone");
    els.input = $("fileInput");
    els.video = $("video");
    els.meta = $("videoMeta");
    els.warn = $("warn");
    els.thumbs = $("thumbs");
    els.mode = $("mode");
    els.interval = $("interval");
    els.timeList = $("timeList");
    els.maxFrames = $("maxFrames");
    els.outWidth = $("outWidth");
    els.format = $("format");
    els.quality = $("quality");
    els.qualityVal = $("qualityVal");
    els.btnExtract = $("btnExtract");
    els.btnSingle = $("btnSingle");
    els.btnClear = $("btnClear");
    els.btnZip = $("btnZip");
    els.statStatus = $("statStatus");
    els.statFrames = $("statFrames");
    els.statSize = $("statSize");
    els.progressWrap = $("progressWrap");
    els.progressBar = $("progressBar");
    els.intervalWrap = $("intervalWrap");
    els.listWrap = $("listWrap");
    els.singleWrap = $("singleWrap");

    Toolkit.bindDrop(els.dropzone, els.input, onFiles);
    els.video.addEventListener("loadedmetadata", onMeta);
    els.video.addEventListener("error", onVideoError);

    els.mode.addEventListener("change", function () {
      var m = els.mode.value;
      els.intervalWrap.hidden = m !== "interval";
      els.listWrap.hidden = m !== "list";
      els.singleWrap.hidden = m !== "single";
    });

    els.quality.addEventListener("input", function () {
      els.qualityVal.textContent = Math.round(parseFloat(els.quality.value) * 100) + "%";
    });

    els.btnExtract.addEventListener("click", extract);
    els.btnSingle.addEventListener("click", grabOnce);
    els.btnZip.addEventListener("click", zipAll);
    els.btnClear.addEventListener("click", function () {
      clearFrames();
      setStatus(tt("nothing"));
    });

    setStatus(tt("nothing"));
    setStats();
  });
})();
