"use strict";
var Picker = (function () {
  var list, hint, toastFn;
  var history = [];

  function init(opts) {
    list = document.getElementById("pickHistory");
    hint = document.getElementById("pickHint");
    toastFn = opts.toast || function () {};
  }

  function pick(img, p) {
    if (!img || !p) return;
    var i = (p.y * img.width + p.x) * 4;
    var r = img.rgba[i], g = img.rgba[i + 1], b = img.rgba[i + 2];
    var hex = "#" + to2(r) + to2(g) + to2(b);
    var text;
    if (img.kind === "depth") {
      var d = img.depth[p.y * img.width + p.x];
      text = d === 0 ? "0 mm (无效)" : Decoder.fmtDepth(d) + " mm";
    } else {
      text = hex + "  rgb(" + r + ", " + g + ", " + b + ")";
    }
    copy(text);
    history.unshift({ text: text, color: hex });
    if (history.length > 18) history.length = 18;
    render();
    toastFn("已复制  " + text);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallback(text); });
    } else {
      fallback(text);
    }
  }

  function fallback(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  function render() {
    if (hint) hint.hidden = true;
    var kids = list.querySelectorAll(".pk");
    for (var i = 0; i < kids.length; i++) kids[i].remove();
    history.forEach(function (h) {
      var b = document.createElement("button");
      b.className = "pk";
      b.style.backgroundColor = h.color;
      b.title = h.text + "（点击复制）";
      b.addEventListener("click", function () {
        copy(h.text);
        toastFn("已复制  " + h.text);
      });
      list.appendChild(b);
    });
  }

  function to2(v) { return (v < 16 ? "0" : "") + v.toString(16); }

  return { init: init, pick: pick };
})();
