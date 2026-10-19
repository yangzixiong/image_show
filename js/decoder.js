"use strict";
var Decoder = (function () {

  var VIRIDIS = [
    [68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142],
    [31, 158, 137], [53, 183, 121], [109, 205, 89], [180, 222, 44], [253, 231, 37]
  ];

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function sampleCmap(name, t, out, o) {
    var r, g, b;
    t = clamp01(t);
    if (name === "gray") {
      r = g = b = Math.round(t * 255);
    } else if (name === "viridis") {
      var f = t * (VIRIDIS.length - 1);
      var i0 = Math.floor(f), i1 = Math.min(i0 + 1, VIRIDIS.length - 1), u = f - i0;
      var a = VIRIDIS[i0], c = VIRIDIS[i1];
      r = Math.round(a[0] + (c[0] - a[0]) * u);
      g = Math.round(a[1] + (c[1] - a[1]) * u);
      b = Math.round(a[2] + (c[2] - a[2]) * u);
    } else {
      var q = 4 * t;
      r = Math.round(255 * clamp01(1.5 - Math.abs(q - 3)));
      g = Math.round(255 * clamp01(1.5 - Math.abs(q - 2)));
      b = Math.round(255 * clamp01(1.5 - Math.abs(q - 1)));
    }
    out[o] = r; out[o + 1] = g; out[o + 2] = b;
  }

  function fmtDepth(d) {
    return d < 10 ? d.toFixed(2) : d.toFixed(1);
  }

  function isTIFF(file) {
    return /\.tiff?$/i.test(file.name);
  }

  function decode(file) {
    if (isTIFF(file)) return decodeTIFF(file);
    return decodeCommon(file);
  }

  function decodeCommon(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        var w = im.naturalWidth, h = im.naturalHeight;
        var c = document.createElement("canvas");
        c.width = w; c.height = h;
        var cx = c.getContext("2d");
        cx.drawImage(im, 0, 0);
        var data;
        try { data = cx.getImageData(0, 0, w, h); }
        catch (err) { URL.revokeObjectURL(url); reject(err); return; }
        URL.revokeObjectURL(url);
        resolve({ name: file.name, width: w, height: h, kind: "color", rgba: data.data, canvas: c, depth: null });
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error("decode failed: " + file.name)); };
      im.src = url;
    });
  }

  async function decodeTIFF(file) {
    if (typeof UTIF === "undefined") throw new Error("TIFF 解码库未加载");
    var buf = await file.arrayBuffer();
    var ifds = UTIF.decode(buf);
    if (!ifds.length) throw new Error("空的 TIFF 文件");
    var ifd = ifds[0];
    UTIF.decodeImage(buf, ifd, ifds);
    var w = ifd.width, h = ifd.height;
    if (!w || !h || !ifd.data) throw new Error("无法解析的 TIFF: " + file.name);

    var bps = ifd.t258 ? ifd.t258[0] : 8;
    var spp = ifd.t277 ? ifd.t277[0] : 1;
    var sfmt = ifd.t339 ? ifd.t339[0] : 1;
    var isDepth = spp === 1 && (bps === 16 || bps === 32);
    if (isDepth) return buildDepth(file.name, ifd, w, h, bps, sfmt);

    var rgba8 = UTIF.toRGBA8(ifd);
    var rgba = new Uint8ClampedArray(rgba8);
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var cx = c.getContext("2d");
    var id = cx.createImageData(w, h);
    id.data.set(rgba);
    cx.putImageData(id, 0, 0);
    return { name: file.name, width: w, height: h, kind: "color", rgba: rgba, canvas: c, depth: null };
  }

  function buildDepth(name, ifd, w, h, bps, sfmt) {
    var n = w * h;
    var depth = new Float32Array(n);
    var dv = new DataView(ifd.data.buffer, ifd.data.byteOffset, ifd.data.byteLength);
    var le = ifd.isLE !== false;
    var i, v;
    if (bps === 16) {
      if (sfmt === 2) {
        for (i = 0; i < n; i++) { v = dv.getInt16(i * 2, le); depth[i] = v < 0 ? 0 : v; }
      } else {
        for (i = 0; i < n; i++) depth[i] = dv.getUint16(i * 2, le);
      }
    } else if (sfmt === 3) {
      for (i = 0; i < n; i++) depth[i] = dv.getFloat32(i * 4, le) * 1000;
    } else {
      for (i = 0; i < n; i++) depth[i] = dv.getUint32(i * 4, le);
    }
    var min = Infinity, max = -Infinity, hasZero = false;
    for (i = 0; i < n; i++) {
      v = depth[i];
      if (v === 0) { hasZero = true; continue; }
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min > max) { min = 0; max = 0; }

    var img = {
      name: name, width: w, height: h, kind: "depth",
      depth: depth, dmin: min, dmax: max, hasZero: hasZero,
      cmap: "jet", rgba: new Uint8ClampedArray(n * 4),
      canvas: document.createElement("canvas")
    };
    img.canvas.width = w;
    img.canvas.height = h;
    applyCmap(img, "jet");
    return img;
  }

  function applyCmap(img, name) {
    var n = img.width * img.height;
    var span = img.dmax - img.dmin;
    if (!(span > 0)) span = 1;
    var rgba = img.rgba;
    for (var i = 0, o = 0; i < n; i++, o += 4) {
      var d = img.depth[i];
      if (d === 0) { rgba[o] = rgba[o + 1] = rgba[o + 2] = rgba[o + 3] = 0; continue; }
      sampleCmap(name, (d - img.dmin) / span, rgba, o);
      rgba[o + 3] = 255;
    }
    img.cmap = name;
    var cx = img.canvas.getContext("2d");
    var id = cx.createImageData(img.width, img.height);
    id.data.set(rgba);
    cx.putImageData(id, 0, 0);
  }

  return { decode: decode, applyCmap: applyCmap, fmtDepth: fmtDepth };
})();
