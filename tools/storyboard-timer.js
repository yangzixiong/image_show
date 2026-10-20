"use strict";
/**
 * 分镜计时器。
 *
 * 给 AI 视频 / 短片排分镜：每镜一个时长加一句画面说明，点播放就按时间往下走，
 * 到每一镜的边界响一声，方便对着秒表录屏或按节奏剪。时间用 requestAnimationFrame
 * 累加真实经过的时间，切到后台再回来不会突然跳一大段。
 */
(function () {
  var DICT = {
    zh: {
      play: "播放",
      pause: "暂停",
      idle: "按「播放」开始走时间",
      total: "总时长 {t}s",
      target: "目标 {t}s",
      over: "超出 {d}s",
      under: "还差 {d}s",
      shotN: "第 {n} / {total} 镜",
      finish: "全部镜头走完",
      needShot: "先加至少一个镜头",
      copied: "分镜表已复制",
      exported: "已导出 {name}",
      noTarget: "先在右侧选一个目标时长",
      placeholder: "画面描述，例如：人物回头，慢推",
      duration: "时长"
    },
    en: {
      play: "Play",
      pause: "Pause",
      idle: "Press Play to start the clock",
      total: "Total {t}s",
      target: "Target {t}s",
      over: "Over by {d}s",
      under: "{d}s to go",
      shotN: "Shot {n} / {total}",
      finish: "All shots done",
      needShot: "Add at least one shot",
      copied: "Storyboard copied",
      exported: "Exported {name}",
      noTarget: "Pick a target length first",
      placeholder: "What happens, e.g. character turns, slow push in",
      duration: "Duration"
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

  var state = { shots: [], elapsed: 0, playing: false, last: 0, raf: 0, active: -1, audio: null };
  var els = {};

  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function fmt(sec) {
    var m = Math.floor(Math.max(0, sec) / 60);
    var s = Math.max(0, sec) - m * 60;
    return pad(m) + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
  }

  function totalSeconds() {
    var sum = 0;
    state.shots.forEach(function (s) { sum += s.sec || 0; });
    return sum;
  }

  function targetSeconds() {
    return parseFloat(els.target.value) || 0;
  }

  function indexAt(t) {
    var acc = 0;
    for (var i = 0; i < state.shots.length; i++) {
      acc += state.shots[i].sec || 0;
      if (t < acc - 1e-9) return i;
    }
    return state.shots.length - 1;
  }

  /* ---------------- 渲染 ---------------- */

  function renderRows() {
    els.list.innerHTML = "";

    state.shots.forEach(function (shot, i) {
      var row = document.createElement("div");
      row.className = "shot-row";
      row.dataset.i = String(i);

      var idx = document.createElement("span");
      idx.className = "shot-idx";
      idx.textContent = String(i + 1);

      var dur = document.createElement("input");
      dur.className = "ctl-input";
      dur.type = "number";
      dur.min = "0.1";
      dur.step = "0.1";
      dur.value = String(shot.sec);
      dur.setAttribute("aria-label", tt("duration"));
      dur.addEventListener("input", function () {
        shot.sec = Math.max(0, parseFloat(dur.value) || 0);
        renderSummary();
      });

      var text = document.createElement("input");
      text.className = "ctl-input";
      text.type = "text";
      text.value = shot.text || "";
      text.placeholder = tt("placeholder");
      text.addEventListener("input", function () {
        shot.text = text.value;
      });

      var del = document.createElement("button");
      del.className = "shot-del";
      del.type = "button";
      del.textContent = "×";
      del.setAttribute("aria-label", "delete");
      del.addEventListener("click", function () {
        state.shots.splice(i, 1);
        stop();
        state.elapsed = 0;
        renderRows();
        renderSummary();
      });

      row.appendChild(idx);
      row.appendChild(dur);
      row.appendChild(text);
      row.appendChild(del);
      els.list.appendChild(row);
    });

    renderSummary();
  }

  function renderSummary() {
    var total = totalSeconds();
    var target = targetSeconds();

    els.clock.textContent = fmt(state.elapsed);

    var parts = [tt("total", { t: total.toFixed(1) })];
    if (target) {
      var diff = total - target;
      parts.push(tt("target", { t: target.toFixed(0) }));
      if (diff > 0.05) {
        parts.push('<span class="over-budget">' + tt("over", { d: diff.toFixed(1) }) + "</span>");
      } else if (diff < -0.05) {
        parts.push(tt("under", { d: Math.abs(diff).toFixed(1) }));
      }
    }
    els.summary.innerHTML = parts.join(" · ");

    if (state.playing) {
      var i = indexAt(state.elapsed);
      var acc = 0;
      for (var k = 0; k < i; k++) acc += state.shots[k].sec || 0;
      var left = acc + (state.shots[i] ? state.shots[i].sec : 0) - state.elapsed;
      els.state.textContent = tt("shotN", { n: i + 1, total: state.shots.length }) +
        " · " + tt("under", { d: Math.max(0, left).toFixed(1) });
    }
  }

  function updateActive() {
    var i = state.playing ? indexAt(state.elapsed) : -1;
    var rows = els.list.children;
    for (var r = 0; r < rows.length; r++) {
      rows[r].classList.toggle("active", r === i);
      rows[r].classList.toggle("done", i >= 0 && r < i);
    }
  }

  /* ---------------- 播放 ---------------- */

  function beep() {
    if (!els.notify.checked) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!state.audio) state.audio = new AC();
      var ctx = state.audio;
      if (ctx.state === "suspended") ctx.resume();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch (e) {
      /* 静音环境或浏览器限制，忽略 */
    }
  }

  function tick(now) {
    if (!state.playing) return;

    var dt = (now - state.last) / 1000;
    state.last = now;
    if (dt > 0.5) dt = 0.5; // 切标签页回来时不要一次跳很远

    state.elapsed += dt;
    var total = totalSeconds();

    var i = indexAt(state.elapsed);
    if (i !== state.active) {
      if (state.active >= 0) beep();
      state.active = i;
    }

    els.clock.textContent = fmt(Math.min(state.elapsed, total));
    updateActive();
    renderSummary();

    if (state.elapsed >= total) {
      state.elapsed = total;
      stop();
      els.state.textContent = tt("finish");
      els.clock.textContent = fmt(total);
      updateActive();
      return;
    }

    state.raf = requestAnimationFrame(tick);
  }

  function start() {
    if (!state.shots.length) { Toolkit.toast(tt("needShot")); return; }
    if (totalSeconds() <= 0) { Toolkit.toast(tt("needShot")); return; }
    if (state.elapsed >= totalSeconds() - 1e-6) state.elapsed = 0;

    state.playing = true;
    state.last = performance.now();
    state.active = indexAt(state.elapsed);
    els.btnPlay.textContent = tt("pause");
    els.state.textContent = "";
    state.raf = requestAnimationFrame(tick);
  }

  function stop() {
    state.playing = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    els.btnPlay.textContent = tt("play");
    updateActive();
  }

  function toggle() {
    if (state.playing) {
      stop();
      renderSummary();
    } else {
      start();
    }
  }

  /* ---------------- 导出 ---------------- */

  function rowsToText() {
    return state.shots.map(function (s, i) {
      return (i + 1) + ". " + (s.sec || 0).toFixed(1) + "s — " + (s.text || "");
    }).join("\n");
  }

  function copyText() {
    if (!state.shots.length) { Toolkit.toast(tt("needShot")); return; }
    var text = rowsToText();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        Toolkit.toast(tt("copied"));
      }, function () {
        fallbackCopy(text);
      });
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      Toolkit.toast(tt("copied"));
    } catch (e) {
      Toolkit.toast(tt("copied"));
    }
    document.body.removeChild(ta);
  }

  function exportCsv() {
    if (!state.shots.length) { Toolkit.toast(tt("needShot")); return; }
    var head = "shot,seconds,description";
    var lines = state.shots.map(function (s, i) {
      var desc = (s.text || "").replace(/"/g, '""');
      return (i + 1) + "," + (s.sec || 0).toFixed(1) + ',"' + desc + '"';
    });
    var csv = "\ufeff" + [head].concat(lines).join("\r\n") + "\r\n";
    var name = "storyboard-" + state.shots.length + "-shots.csv";
    Toolkit.download(new Blob([csv], { type: "text/csv;charset=utf-8" }), name);
    Toolkit.toast(tt("exported", { name: name }));
  }

  /* ---------------- 绑定 ---------------- */

  document.addEventListener("DOMContentLoaded", function () {
    els.list = $("shotList");
    els.clock = $("clock");
    els.summary = $("summary");
    els.state = $("timerState");
    els.target = $("target");
    els.notify = $("notify");
    els.btnPlay = $("btnPlay");
    els.btnReset = $("btnReset");
    els.btnAdd = $("btnAdd");
    els.btnEven = $("btnEven");
    els.btnCopy = $("btnCopy");
    els.btnCsv = $("btnCsv");

    state.shots = [
      { sec: 3, text: "" },
      { sec: 4, text: "" },
      { sec: 5, text: "" }
    ];

    renderRows();
    els.state.textContent = tt("idle");

    els.btnPlay.addEventListener("click", toggle);

    els.btnReset.addEventListener("click", function () {
      stop();
      state.elapsed = 0;
      state.active = -1;
      els.clock.textContent = fmt(0);
      els.state.textContent = tt("idle");
      updateActive();
      renderSummary();
    });

    els.btnAdd.addEventListener("click", function () {
      state.shots.push({ sec: 3, text: "" });
      renderRows();
    });

    els.btnEven.addEventListener("click", function () {
      var target = targetSeconds();
      if (!target) { Toolkit.toast(tt("noTarget")); return; }
      if (!state.shots.length) { Toolkit.toast(tt("needShot")); return; }
      var each = Math.round((target / state.shots.length) * 10) / 10;
      state.shots.forEach(function (s) { s.sec = each; });
      renderRows();
      els.state.textContent = tt("idle");
    });

    els.target.addEventListener("change", renderSummary);
    els.btnCopy.addEventListener("click", copyText);
    els.btnCsv.addEventListener("click", exportCsv);

    document.addEventListener("keydown", function (e) {
      if (e.code !== "Space") return;
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return;
      e.preventDefault();
      toggle();
    });

    renderSummary();
  });
})();
