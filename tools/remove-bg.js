"use strict";
/**
 * 图片抠图 / 背景移除（浏览器内 ONNX 推理，无后端）。
 *
 * 两个模型按需加载——首次点「开始处理」才下载，之后走浏览器缓存：
 *   人像  MODNet uint8  /models/modnet-uint8.onnx  动态输入，最长边 512、按 32 对齐
 *   通用  U2Netp        /models/u2netp.onnx        固定输入 320×320
 * onnxruntime-web（wasm 后端，vendor 在 /lib/ort/）同样按需注入；单线程运行，
 * 不需要 COOP/COEP 跨域隔离头。
 *
 * 输出两份结果：透明背景 PNG（原图 × 遮罩 destination-in）与黑白遮罩 PNG
 * （灰度 = alpha，可直接给 ControlNet 用），支持 fflate 打包下载。
 */
(function () {
  var MODELS = {
    portrait: {
      file: "/models/modnet-uint8.onnx", mb: "6.3",
      input: "input", output: "output",
      maxSide: 512, align: 32, fixed: 0,
      mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5]
    },
    general: {
      file: "/models/u2netp.onnx", mb: "4.4",
      input: "input.1", output: "1959",
      maxSide: 0, align: 0, fixed: 320,
      mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225]
    }
  };

  var DICT = {
    zh: {
      noImage: "尚未载入图片",
      decodeFail: "无法解码 {name}",
      dlModel: "下载模型中（约 {mb} MB，仅首次）…",
      loading: "加载推理引擎…",
      running: "推理中，约需几秒到十几秒…",
      done: "完成，用时 {t} 秒",
      exported: "已导出 {name}（{size}）",
      packed: "已导出 {name}（{size}）",
      packFail: "打包失败，请重试",
      runFail: "推理失败，请重试或换一张图"
    },
    en: {
      noImage: "No image loaded yet",
      decodeFail: "Could not decode {name}",
      dlModel: "Downloading model (~{mb} MB, first time only)…",
      loading: "Loading inference engine…",
      running: "Running inference, this takes a few seconds…",
      done: "Done in {t}s",
      exported: "Exported {name} ({size})",
      packed: "Exported {name} ({size})",
      packFail: "Could not build the ZIP — please try again",
      runFail: "Inference failed, please retry or use another image"
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

  var state = { img: null, modelKey: "portrait", busy: false };
  var ortReady = null;
  var sessions = {};
  var els = {};

  function $(id) { return document.getElementById(id); }

  document.addEventListener("DOMContentLoaded", function () {
    els.dropzone = $("dropzone");
    els.input = $("fileInput");
    els.wrap = $("rbWrap");
    els.empty = $("rbEmpty");
    els.cut = $("cutCanvas");
    els.mask = $("maskCanvas");
    els.info = $("rbInfo");
    els.btnRun = $("btnRun");
    els.btnPng = $("btnPng");
    els.btnMask = $("btnMask");
    els.btnZip = $("btnZip");

    Toolkit.bindDrop(els.dropzone, els.input, onFiles);

    Array.prototype.forEach.call(document.querySelectorAll('input[name="modelKey"]'), function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) state.modelKey = radio.value;
      });
    });

    els.btnRun.addEventListener("click", run);
    els.btnPng.addEventListener("click", function () { exportCanvas(els.cut, "-cut.png"); });
    els.btnMask.addEventListener("click", function () { exportCanvas(els.mask, "-mask.png"); });
    els.btnZip.addEventListener("click", exportZip);
  });

  function onFiles(list) {
    var f = Toolkit.pickFile(list);
    if (!f) { Toolkit.toast(tt("noImage")); return; }
    Decoder.decode(f).then(function (img) {
      state.img = img;
      els.dropzone.hidden = true;
      els.empty.hidden = false;
      els.wrap.hidden = true;
      els.info.textContent = img.width + " × " + img.height;
    }).catch(function () {
      Toolkit.toast(tt("decodeFail", { name: f.name }));
    });
  }

  /* ---- 按需加载 onnxruntime-web 与模型会话 ---- */

  function ensureRuntime() {
    if (ortReady) return ortReady;
    ortReady = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "/lib/ort/ort.min.js";
      s.onload = function () {
        // 用对象形式指定产物：1.22 的加载器默认会去找 ort-wasm-simd-threaded.jsep.mjs，
        // 仓库里只有非 jsep 的同名产物，直接给字符串前缀会 404。
        ort.env.wasm.wasmPaths = {
          mjs: "/lib/ort/ort-wasm-simd-threaded.mjs",
          wasm: "/lib/ort/ort-wasm-simd-threaded.wasm"
        };
        ort.env.wasm.numThreads = 1;
        resolve();
      };
      s.onerror = function () {
        ortReady = null;   // 允许下次重试（否则一次失败后永远报「推理失败」）
        reject(new Error("ort load failed"));
      };
      document.head.appendChild(s);
    });
    return ortReady;
  }

  function ensureSession(key) {
    if (sessions[key]) return sessions[key];
    var cfg = MODELS[key];
    sessions[key] = ensureRuntime().then(function () {
      return fetch(cfg.file).then(function (r) {
        if (!r.ok) throw new Error("model http " + r.status);
        return r.arrayBuffer();
      }).then(function (buf) {
        return ort.InferenceSession.create(buf, { executionProviders: ["wasm"] });
      });
    }).catch(function (e) {
      delete sessions[key];
      throw e;
    });
    return sessions[key];
  }

  /* ---- 推理管线 ---- */

  function targetSize(img, cfg) {
    if (cfg.fixed) return { w: cfg.fixed, h: cfg.fixed };
    var scale = cfg.maxSide / Math.max(img.width, img.height);
    if (scale > 1) scale = 1;
    var align = function (v) {
      v = Math.round(v * scale / cfg.align) * cfg.align;
      return Math.max(cfg.align, Math.min(cfg.maxSide, v));
    };
    return { w: align(img.width), h: align(img.height) };
  }

  function toTensor(img, cfg, size) {
    var cv = document.createElement("canvas");
    cv.width = size.w; cv.height = size.h;
    var ctx = cv.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img.canvas, 0, 0, size.w, size.h);
    var data = ctx.getImageData(0, 0, size.w, size.h).data;
    var n = size.w * size.h;
    var buf = new Float32Array(3 * n);
    // NCHW + mean/std 归一化
    var CH = [n, 2 * n];
    for (var i2 = 0; i2 < n; i2++) {
      buf[i2] = (data[i2 * 4] / 255 - cfg.mean[0]) / cfg.std[0];
      buf[CH[0] + i2] = (data[i2 * 4 + 1] / 255 - cfg.mean[1]) / cfg.std[1];
      buf[CH[1] + i2] = (data[i2 * 4 + 2] / 255 - cfg.mean[2]) / cfg.std[2];
    }
    return new ort.Tensor("float32", buf, [1, 3, size.h, size.w]);
  }

  function run() {
    if (!state.img || state.busy) { if (!state.img) Toolkit.toast(tt("noImage")); return; }
    var cfg = MODELS[state.modelKey];
    var img = state.img;
    state.busy = true;
    els.btnRun.disabled = true;

    if (!sessions[state.modelKey]) Toolkit.toast(tt("dlModel", { mb: cfg.mb }));
    else Toolkit.toast(tt("running"));

    var t0 = Date.now();
    ensureSession(state.modelKey).then(function (session) {
      Toolkit.toast(tt("running"));
      var size = targetSize(img, cfg);
      var input = toTensor(img, cfg, size);
      var feeds = {};
      feeds[cfg.input] = input;
      return session.run(feeds, [cfg.output]).then(function (out) {
        applyResult(img, out[cfg.output]);
        Toolkit.toast(tt("done", { t: ((Date.now() - t0) / 1000).toFixed(1) }));
      });
    }).catch(function () {
      Toolkit.toast(tt("runFail"));
    }).finally(function () {
      state.busy = false;
      els.btnRun.disabled = false;
    });
  }

  function applyResult(img, tensor) {
    var dims = tensor.dims;
    var mw = dims[dims.length - 1], mh = dims[dims.length - 2];
    var alpha = tensor.data;

    // 小尺寸 alpha 遮罩（rgb 任意，alpha = 遮罩值），再平滑放大回原图尺寸
    var small = document.createElement("canvas");
    small.width = mw; small.height = mh;
    var sctx = small.getContext("2d");
    var sid = sctx.createImageData(mw, mh);
    for (var i = 0; i < mw * mh; i++) {
      var v = Math.max(0, Math.min(255, Math.round(alpha[i] * 255)));
      sid.data[i * 4 + 3] = v;
    }
    sctx.putImageData(sid, 0, 0);

    var full = document.createElement("canvas");
    full.width = img.width; full.height = img.height;
    var fctx = full.getContext("2d");
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = "high";
    fctx.drawImage(small, 0, 0, img.width, img.height);

    // 透明 PNG：原图 × 遮罩 alpha
    els.cut.width = img.width; els.cut.height = img.height;
    var cctx = els.cut.getContext("2d");
    cctx.clearRect(0, 0, img.width, img.height);
    cctx.drawImage(img.canvas, 0, 0);
    cctx.globalCompositeOperation = "destination-in";
    cctx.drawImage(full, 0, 0);
    cctx.globalCompositeOperation = "source-over";

    // 黑白遮罩：灰度 = alpha，不透明白底以外全黑（ControlNet 输入）
    els.mask.width = img.width; els.mask.height = img.height;
    var mctx = els.mask.getContext("2d");
    var fd = fctx.getImageData(0, 0, img.width, img.height);
    var mid = mctx.createImageData(img.width, img.height);
    for (var j = 0; j < img.width * img.height; j++) {
      var g = fd.data[j * 4 + 3];
      mid.data[j * 4] = g; mid.data[j * 4 + 1] = g; mid.data[j * 4 + 2] = g; mid.data[j * 4 + 3] = 255;
    }
    mctx.putImageData(mid, 0, 0);

    els.empty.hidden = true;
    els.wrap.hidden = false;
  }

  /* ---- 导出 ---- */

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        blob ? resolve(blob) : reject(new Error("toBlob failed"));
      }, "image/png");
    });
  }

  function exportCanvas(canvas, suffix) {
    if (!state.img || els.wrap.hidden) { Toolkit.toast(tt("noImage")); return; }
    toBlob(canvas).then(function (blob) {
      var name = Toolkit.baseName(state.img.name) + suffix;
      Toolkit.download(blob, name);
      Toolkit.toast(tt("exported", { name: name, size: Toolkit.fmtBytes(blob.size) }));
    });
  }

  function exportZip() {
    if (!state.img || els.wrap.hidden) { Toolkit.toast(tt("noImage")); return; }
    var base = Toolkit.baseName(state.img.name);
    Promise.all([toBlob(els.cut), toBlob(els.mask)]).then(function (blobs) {
      return Promise.all(blobs.map(function (b) { return b.arrayBuffer(); }));
    }).then(async function (bufs) {
      var files = {};
      files[base + "-cut.png"] = new Uint8Array(bufs[0]);
      files[base + "-mask.png"] = new Uint8Array(bufs[1]);
      var ff = await Toolkit.ensureFflate();
      var zipped = ff.zipSync(files, { level: 0 });
      var blob = new Blob([zipped], { type: "application/zip" });
      var name = base + "-cutout.zip";
      Toolkit.download(blob, name);
      Toolkit.toast(tt("packed", { name: name, size: Toolkit.fmtBytes(blob.size) }));
    }).catch(function () {
      Toolkit.toast(tt("packFail"));
    });
  }
})();
