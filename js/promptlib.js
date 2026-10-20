"use strict";
/**
 * PromptLib —— Stable Diffusion 提示词纯逻辑解析库（无 DOM、无 i18n 依赖）。
 *
 * 四个方法（批 3 任务书 docs/opencode-task-positioning.md §3.1）：
 *   PromptLib.parseWeighted(text, {dialect})      解析带权重的提示词
 *   PromptLib.splitPositiveNegative(text)         拆分正反词
 *   PromptLib.buildNegative(ids, custom, lib)     按词条 id 拼负面词
 *   PromptLib.countTokens(text, {vocab, table})   分词计数（有词表精确、无词表粗估）
 *
 * 约定：
 *   - 解析永不 throw：语法错误以 {from, to, code, message} 返回，位置为原文字符下标（UTF-16 码元）。
 *   - message 是中文兜底文案；code 供页面做中英本地化（如 WEIGHT_NAN → 页内 DICT）。
 *   - 词表由调用方加载后传入；table 结构：
 *       clip      : {type:"clip", encoder:{token:id}, merges:["a b", ...]}   （vocab.json + merges.txt）
 *       tiktoken  : {type:"tiktoken", ranks:{token:rank}}                    （cl100k/o200k rank 表）
 */
var PromptLib = (function () {

  /* ======================= 1. 权重解析 ======================= */

  var OPEN = { "(": ")", "[": "]", "{": "}" };
  var MAX_DEPTH = 8;

  function escDecode(s) {
    return s.replace(/\\([()[\]{}])/g, "$1");
  }

  function round3(x) {
    return Math.round(x * 1000) / 1000;
  }

  /**
   * 解析带权重的提示词。
   * 支持：(word)（a1111 ×1.1 / comfyui ×1.0）、[word]（÷1.1）、(word:1.3)、{word}（×1.05）、
   * 嵌套相乘、\( \[ 转义、BREAK、AND；comfyui 方言额外标出 [a|b] / {a|b|c} 的 alternation。
   * @param {string} text
   * @param {{dialect?: "a1111"|"comfyui"}} opts
   * @returns {{items: Array<{text:string,weight:number,from:number,to:number,depth:number,alternation?:boolean}>,
   *            errors: Array<{from:number,to:number,code:string,message:string}>}}
   */
  function parseWeighted(text, opts) {
    var dialect = (opts && opts.dialect === "comfyui") ? "comfyui" : "a1111";
    var items = [];
    var errors = [];
    if (text == null) text = "";

    var root = { open: null, from: 0, children: [], weight: 1, depth: 0, alternation: false };
    var stack = [];
    var cur = root;
    var bufStart = 0; // 当前纯文本游程在原文中的起点

    function err(from, to, code, message) {
      errors.push({ from: from, to: Math.max(to, from + 1), code: code, message: message });
    }

    function flush(end) {
      if (end > bufStart) {
        cur.children.push({ type: "text", from: bufStart, to: end });
      }
      bufStart = end;
    }

    function hasTopAlternation(node) {
      // 顶层 |（不在嵌套组内、未转义）视为交替分隔
      var depth = 0;
      for (var i = node.from + 1; i < node.rawEnd; i++) {
        var c = text.charAt(i);
        if (c === "\\") { i++; continue; }
        if (c === "(" || c === "[" || c === "{") depth++;
        else if (c === ")" || c === "]" || c === "}") depth--;
        else if (c === "|" && depth === 0) return true;
      }
      return false;
    }

    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);

      if (c === "\\" && i + 1 < text.length) {
        i++; // 转义：下一个字符按字面处理（留在文本游程里）
        continue;
      }

      if (c === "(" || c === "[" || c === "{") {
        flush(i);
        var depth = stack.length + 1;
        if (depth > MAX_DEPTH) {
          err(i, i + 1, "DEPTH", "嵌套超过 " + MAX_DEPTH + " 层");
        }
        var node = { open: c, from: i, rawEnd: -1, children: [], weight: null, depth: depth, alternation: false };
        cur.children.push(node);
        stack.push(node);
        cur = node;
        bufStart = i + 1;
        continue;
      }

      if (c === ")" || c === "]" || c === "}") {
        if (stack.length === 0) {
          err(i, i + 1, "UNMATCHED_CLOSE", "多余的右括号 “" + c + "”");
          continue; // 字面保留在文本游程里
        }
        var node2 = stack.pop();
        if (OPEN[node2.open] !== c) {
          err(i, i + 1, "MISMATCH", "括号类型不匹配：期望 “" + OPEN[node2.open] + "” 实际 “" + c + "”");
        }
        flush(i);
        node2.rawEnd = i;
        node2.closeFrom = i;

        // 提取显式权重 (content:1.3)
        var explicit = null;
        var last = node2.children[node2.children.length - 1];
        if (last && last.type === "text") {
          var raw = text.slice(last.from, last.to);
          var m = raw.match(/:\s*([+-]?[0-9]*\.?[0-9]+)\s*$/);
          if (m) {
            explicit = parseFloat(m[1]);
            var cutTo = last.to;
            var cutFrom = cutTo - m[0].length;
            if (isNaN(explicit)) {
              err(cutFrom, cutTo, "WEIGHT_NAN", "权重不是数字：“" + m[1] + "”");
              explicit = null;
            }
            // 从文本节点里裁掉 ":1.3"
            if (m[0].length === raw.length) {
              node2.children.pop();
            } else {
              last.to = cutFrom;
            }
          } else if (/:\s*\S*$/.test(raw)) {
            // 形如 (word:abc)：末尾有冒号但不是数字
            var m2 = raw.match(/:(\S*)$/);
            var eFrom = last.to - m2[0].length;
            err(eFrom, last.to, "WEIGHT_NAN", "权重不是数字：“" + m2[1] + "”");
          }
        }

        var w;
        if (explicit != null) w = explicit;
        else if (node2.open === "(") w = (dialect === "a1111") ? 1.1 : 1.0;
        else if (node2.open === "[") w = 1 / 1.1;
        else w = 1.05;
        node2.weight = w;

        if (dialect === "comfyui" && (node2.open === "[" || node2.open === "{")) {
          node2.alternation = hasTopAlternation(node2);
        }

        cur = stack.length ? stack[stack.length - 1] : root;
        bufStart = i + 1;
        continue;
      }
      // 普通字符：留在游程里（由下一次 flush 处理）
    }

    flush(text.length);
    while (stack.length) {
      var un = stack.pop();
      err(un.from, un.from + 1, "UNCLOSED", "左括号 “" + un.open + "” 未闭合");
    }

    // 展平：累乘权重
    (function walk(node, mul, depth) {
      for (var i2 = 0; i2 < node.children.length; i2++) {
        var ch = node.children[i2];
        if (ch.type === "text") {
          var raw = text.slice(ch.from, ch.to);
          if (ch.to > ch.from && raw.trim() !== "") { // 纯空白游程不进结果（展示更干净）
            var it = {
              text: escDecode(raw),
              weight: round3(mul),
              from: ch.from,
              to: ch.to,
              depth: depth
            };
            if (node.alternation) it.alternation = true;
            items.push(it);
          }
        } else {
          walk(ch, mul * (ch.weight == null ? 1 : ch.weight), depth + 1);
        }
      }
    })(root, 1, 0);

    return { items: items, errors: errors };
  }

  /** 权重 → 色带（≤0.5 灰蓝 / <1.0 蓝 / =1.0 白 / ≤1.5 橙 / >1.5 红） */
  function bandOf(w) {
    if (w <= 0.5) return "low";
    if (w < 0.9995) return "blue";
    if (w <= 1.0005) return "white";
    if (w <= 1.5) return "orange";
    return "red";
  }

  /* ======================= 2. 正反词拆分 ======================= */

  /**
   * 自动识别并拆分正反词。
   * @returns {{positive:string, negative:string, unknown:string,
   *            detected:"labeled"|"separator"|"blankline"|"none", detectedDetail?:string}}
   */
  function splitPositiveNegative(text) {
    if (text == null) text = "";
    var out = { positive: "", negative: "", unknown: "", detected: "none" };

    var trimmed = text.trim();
    if (!trimmed) return out;

    // a) JSON：{"prompt": "...", "negative_prompt": "..."}（兼容 positive/negative 键）
    if (trimmed.charAt(0) === "{") {
      try {
        var obj = JSON.parse(trimmed);
        var pos = obj.prompt != null ? obj.prompt : obj.positive;
        var neg = obj.negative_prompt != null ? obj.negative_prompt : obj.negative;
        if (pos != null || neg != null) {
          out.positive = String(pos == null ? "" : pos);
          out.negative = String(neg == null ? "" : neg);
          out.detected = "labeled";
          out.detectedDetail = "json";
          var extra = Object.keys(obj).filter(function (k) {
            return ["prompt", "positive", "negative_prompt", "negative"].indexOf(k) === -1;
          });
          if (extra.length) out.unknown = extra.map(function (k) { return k + ": " + obj[k]; }).join("; ");
          return out;
        }
      } catch (e) { /* 不是合法 JSON，继续往下 */ }
    }

    // b) 标签行：Positive: / Negative prompt:（大小写不敏感；A1111 复制为「正面在前、Negative prompt: 收尾」）
    var reLabel = /^[ \t]*(positive|negative)(?:[ \t]+prompts?)?[ \t]*:[ \t]*/gim;
    var labels = [];
    var mm;
    while ((mm = reLabel.exec(text)) !== null) {
      labels.push({ kind: mm[1].toLowerCase(), index: mm.index, contentStart: reLabel.lastIndex });
    }
    if (labels.length) {
      out.detected = "labeled";
      var prefix = text.slice(0, labels[0].index).trim();
      if (prefix) {
        // 首个标签是 Negative 时，前缀即无标签的正面词（A1111 常见格式）
        if (labels[0].kind === "negative") out.positive = prefix;
        else out.unknown = prefix;
      }
      for (var li = 0; li < labels.length; li++) {
        var seg = text.slice(labels[li].contentStart,
          li + 1 < labels.length ? labels[li + 1].index : text.length);
        seg = stripTrailingSeparator(seg).trim();
        if (labels[li].kind === "positive") out.positive = seg;
        else out.negative = seg;
      }
      if (!out.positive && !out.negative && !out.unknown) {
        // 标签匹配了但没内容：回落到 none
        out.detected = "none";
        out.positive = text.trim();
      }
      return out;
    }

    // c) ### 分隔线（NovelAI 风格）
    var hashLines = text.split(/\r?\n/);
    var cut = -1;
    for (var hi = 0; hi < hashLines.length; hi++) {
      if (/^\s*#{3,}\s*$/.test(hashLines[hi])) { cut = hi; break; }
    }
    if (cut >= 0) {
      out.positive = hashLines.slice(0, cut).join("\n").trim();
      out.negative = hashLines.slice(cut + 1).join("\n").trim();
      out.detected = "separator";
      out.detectedDetail = "hash";
      return out;
    }

    // d) --no <负面>（Midjourney 风格，取到行尾）
    var noMatch = text.match(/(^|\s)--no\b[ \t]*([^\n\r]*)/);
    if (noMatch && noMatch[2].trim()) {
      out.negative = noMatch[2].trim();
      out.positive = (text.slice(0, noMatch.index + noMatch[1].length) +
        text.slice(noMatch.index + noMatch[0].length)).trim();
      out.detected = "separator";
      out.detectedDetail = "flag";
      return out;
    }

    // e) 空行分隔：第一段正面、其余段负面
    var parts = text.split(/\r?\n[ \t]*\r?\n+/);
    if (parts.length >= 2 && parts[0].trim() && parts.slice(1).join("\n").trim()) {
      out.positive = parts[0].trim();
      out.negative = parts.slice(1).join("\n").trim();
      out.detected = "blankline";
      return out;
    }

    // f) 认不出：整段进 Positive
    out.positive = text.trim();
    out.detected = "none";
    return out;
  }

  function stripTrailingSeparator(s) {
    return s.replace(/^[ \t]*\r?\n/, "").replace(/\r?\n[ \t]*$/, "");
  }

  /* ======================= 3. 负面词拼接 ======================= */

  /**
   * 按词条 id 拼一行可直接粘贴的负面提示词。
   * @param {string[]} selectedIds 已勾选词条 id
   * @param {string} customText 自定义补充（整段透传）
   * @param {{groups:Array<{items:Array<{id:string,text:string}>}>}|Array} lib 词条库
   * @returns {string}
   */
  function buildNegative(selectedIds, customText, lib) {
    var idSet = {};
    (selectedIds || []).forEach(function (id) { idSet[id] = true; });
    var groups = Array.isArray(lib) ? lib : (lib && lib.groups) || [];
    var parts = [];
    var seen = {};
    function push(s) {
      s = String(s || "").trim();
      if (!s) return;
      s.split(/\s*,\s*/).forEach(function (piece) {
        piece = piece.trim();
        if (!piece) return;
        var key = piece.toLowerCase();
        if (seen[key]) return; // 去重（同一词条出现在多个组）
        seen[key] = true;
        parts.push(piece);
      });
    }
    groups.forEach(function (g) {
      (g.items || []).forEach(function (it) {
        if (idSet[it.id]) push(it.text);
      });
    });
    push(customText);
    return parts.join(", ");
  }

  /* ======================= 4. 分词计数 ======================= */

  var CLIP_LIMIT = 77;   // 含首尾 2 个特殊 token
  var T5_LIMIT = 512;

  // GPT-2/CLIP 字节 → Unicode 可打印映射
  var _b2u = null;
  function bytesToUnicode() {
    if (_b2u) return _b2u;
    var bs = [], cs = [], i, b;
    for (i = 33; i <= 126; i++) bs.push(i);
    for (i = 161; i <= 172; i++) bs.push(i);
    for (i = 174; i <= 255; i++) bs.push(i);
    for (i = 0; i < bs.length; i++) cs.push(bs[i]);
    var n = 0;
    for (b = 0; b < 256; b++) {
      if (bs.indexOf(b) === -1) { bs.push(b); cs.push(256 + n); n++; }
    }
    var map = {};
    for (i = 0; i < bs.length; i++) map[bs[i]] = String.fromCharCode(cs[i]);
    _b2u = map;
    return map;
  }

  function utf8Bytes(str) {
    var out = [], i2, c;
    for (i2 = 0; i2 < str.length; i2++) {
      c = str.charCodeAt(i2);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c >= 0xd800 && c <= 0xdbff && i2 + 1 < str.length) {
        var c2 = str.charCodeAt(i2 + 1);
        var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        i2++;
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return out;
  }

  // CLIP 预分词（openai/CLIP simple_tokenizer 的正则，JS 等价）
  var CLIP_RE = /'s|'t|'re|'ve|'m|'ll|'d|[\p{L}]+|[\p{N}]|[^\s\p{L}\p{N}]+/giu;
  // tiktoken 预分词：与 js-tiktoken / tiktoken 官方 pat_str 一致（分词表各有一套，勿混用）
  // cl100k_base：词块为「可选前导非字母数字 + \p{L}+」（含空格并入与汉字 Lo），数字按 1-3 位分组
  var TIKTOKEN_RE = new RegExp(
    "('s|'S|'t|'T|'re|'rE|'Re|'RE|'ve|'vE|'Ve|'VE|'m|'M|'ll|'lL|'Ll|'LL|'d|'D)" +
    "|[^\\r\\n\\p{L}\\p{N}]?\\p{L}+|\\p{N}{1,3}| ?[^\\s\\p{L}\\p{N}]+[\\r\\n]*|\\s*[\\r\\n]+|\\s+(?!\\S)|\\s+",
    "gu");
  // o200k_base：大小写分段更细；缩写用显式大小写枚举（JS 不支持 (?i:...)）；标点块允许尾随 \r\n 与 /
  var TIKTOKEN_O200K_RE = new RegExp(
    "[^\\r\\n\\p{L}\\p{N}]?[\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}]*[\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}]+('s|'S|'t|'T|'re|'rE|'Re|'RE|'ve|'vE|'Ve|'VE|'m|'M|'ll|'lL|'Ll|'LL|'d|'D)?" +
    "|[^\\r\\n\\p{L}\\p{N}]?[\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}]+[\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}]*('s|'S|'t|'T|'re|'rE|'Re|'RE|'ve|'vE|'Ve|'VE|'m|'M|'ll|'lL|'Ll|'LL|'d|'D)?" +
    "|\\p{N}{1,3}| ?[^\\s\\p{L}\\p{N}]+[\\r\\n/]*|\\s*[\\r\\n]+|\\s+(?!\\S)|\\s+",
    "gu");

  function applyMerges(wordChars, mergeRank) {
    // mergeRank: map "a b" -> 序号（越小越先合并）
    var parts = wordChars.slice();
    if (parts.length === 1) return parts;
    while (parts.length > 1) {
      var best = -1, bestIdx = -1;
      for (var i2 = 0; i2 < parts.length - 1; i2++) {
        var r = mergeRank[parts[i2] + " " + parts[i2 + 1]];
        if (r != null && (best === -1 || r < best)) { best = r; bestIdx = i2; }
      }
      if (bestIdx === -1) break;
      parts.splice(bestIdx, 2, parts[bestIdx] + parts[bestIdx + 1]);
    }
    return parts;
  }

  function applyRanks(seq, ranks) {
    var parts = seq.split("");
    while (parts.length > 1) {
      var best = Infinity, bestIdx = -1;
      for (var i2 = 0; i2 < parts.length - 1; i2++) {
        var r = ranks[parts[i2] + parts[i2 + 1]];
        if (r != null && r < best) { best = r; bestIdx = i2; }
      }
      if (bestIdx === -1) break;
      parts.splice(bestIdx, 2, parts[bestIdx] + parts[bestIdx + 1]);
    }
    return parts;
  }

  function clipTokens(text, table) {
    var mergeRank = {};
    for (var i2 = 0; i2 < table.merges.length; i2++) mergeRank[table.merges[i2]] = i2;
    var encoder = table.encoder;
    var clean = text.replace(/\s+/g, " ").trim().toLowerCase();
    var pieces = clean.match(CLIP_RE) || [];
    var count = 0;
    for (var p = 0; p < pieces.length; p++) {
      var chars = pieces[p].split("");
      chars[chars.length - 1] = chars[chars.length - 1] + "</w>";
      var merged = applyMerges(chars, mergeRank);
      for (var k = 0; k < merged.length; k++) {
        count += (encoder[merged[k]] != null) ? 1 : 2; // 未登录片段按字节粗折算
      }
    }
    return count;
  }

  function tiktokenTokens(text, table, vocab) {
    var ranks = table.ranks;
    var b2u = bytesToUnicode();
    var pieces = text.match(vocab === "o200k" ? TIKTOKEN_O200K_RE : TIKTOKEN_RE) || [];
    var count = 0;
    for (var p = 0; p < pieces.length; p++) {
      if (!pieces[p]) continue;
      var bytes = utf8Bytes(pieces[p]);
      var seq = "";
      for (var b = 0; b < bytes.length; b++) seq += b2u[bytes[b]];
      count += applyRanks(seq, ranks).length;
    }
    return count;
  }

  /** 无词表时的 CLIP BPE 粗估（规则见 JSDoc，常见提示词 ±25% 内；词表加载后即被精确值取代） */
  function approxClip(text) {
    var clean = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (!clean) return 0;
    var pieces = clean.match(CLIP_RE) || [];
    var count = 0;
    for (var i2 = 0; i2 < pieces.length; i2++) {
      var w = pieces[i2];
      if (/^[\p{N}]+$/u.test(w)) { count += Math.max(1, Math.ceil(w.length / 3)); continue; }
      if (/^[^\p{L}\p{N}]+$/u.test(w)) { count += Math.max(1, Math.ceil(w.length / 3)); continue; }
      var cjk = (w.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length;
      var rest = w.length - cjk;
      count += cjk * 2;                       // 非拉丁字形在 CLIP 里按字节展开
      if (rest > 0) count += Math.max(1, Math.ceil(rest / 6));
    }
    return Math.max(1, count);
  }

  /** 无词表时的 GPT 系（cl100k/o200k）粗估：空格并入后词不单独计费，词 ≈5 字符/token、标点 ≈3；CJK 按分词表差异取 1.5/1.2 */
  function approxOpenai(text, vocab) {
    var clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return 0;
    var cjkRate = vocab === "o200k" ? 1.2 : 1.5;
    var count = 0;
    var words = clean.split(" ");
    for (var wi = 0; wi < words.length; wi++) {
      var parts = words[wi].match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]+/gu) || [];
      for (var pi = 0; pi < parts.length; pi++) {
        var p = parts[pi];
        if (/^[\p{L}\p{N}]+$/u.test(p)) {
          var cjk = (p.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length;
          var latin = p.length - cjk;
          var n = 0;
          if (cjk) n += Math.max(1, Math.ceil(cjk * cjkRate));
          if (latin) n += Math.max(1, Math.ceil(latin / 5));
          count += n;
        } else {
          count += Math.max(1, Math.ceil(p.length / 3));
        }
      }
    }
    return Math.max(1, count);
  }

  /**
   * 分词计数。
   * @param {string} text
   * @param {{vocab?:"clip"|"cl100k"|"o200k"|"t5", table?:Object}} opts
   *   table 提供时精确（clip 需 {encoder,merges}；cl100k/o200k 需 {ranks}）；
   *   缺省退化为按各 BPE 规则的粗估。T5 为 SentencePiece，无 JS 词表时始终粗估。
   * @returns {{total:number, segments:number, segmentCounts:number[],
   *            limit:number|null, overflowSegments:number[]}}
   *   clip 的 segmentCounts 含首尾 2 个特殊 token（每段 ≤ limit=77）；
   *   段按 BREAK 切分，超限段索引进 overflowSegments。
   */
  function countTokens(text, opts) {
    opts = opts || {};
    var vocab = opts.vocab || "clip";
    var table = opts.table || null;
    text = (text == null) ? "" : String(text);

    function rawCount(t) {
      if (vocab === "clip") {
        if (table && table.type === "clip" && table.encoder && table.merges) return clipTokens(t, table);
        if (table && table.type === "tiktoken" && table.ranks) return tiktokenTokens(t, table, vocab);
        return approxClip(t);
      }
      if (vocab === "cl100k" || vocab === "o200k") {
        if (table && table.ranks) return tiktokenTokens(t, table, vocab);
        return approxOpenai(t, vocab);
      }
      // t5：SentencePiece 词表暂不内置，粗估（拉丁 ≈4 字符/token，CJK ≈1.5 字符/token）
      var cjkLen = (t.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).join("").length;
      var latin = t.length - cjkLen;
      return Math.max(1, Math.ceil(latin / 4) + Math.ceil(cjkLen * 1.5));
    }

    if (vocab === "clip") {
      if (!text.trim()) {
        return { total: 0, segments: 0, segmentCounts: [], limit: CLIP_LIMIT, overflowSegments: [] };
      }
      var segTexts = text.split(/\bBREAK\b/i).map(function (s) { return s.trim(); });
      if (!segTexts.length) segTexts = [""];
      var counts = segTexts.map(function (s) { return rawCount(s) + 2; });
      var total = counts.reduce(function (a, b) { return a + b; }, 0);
      var overflow = [];
      for (var i2 = 0; i2 < counts.length; i2++) if (counts[i2] > CLIP_LIMIT) overflow.push(i2);
      return {
        total: total,
        segments: counts.length,
        segmentCounts: counts,
        limit: CLIP_LIMIT,
        overflowSegments: overflow
      };
    }

    if (vocab === "t5") {
      var n = rawCount(text);
      return {
        total: n,
        segments: 1,
        segmentCounts: [n],
        limit: T5_LIMIT,
        overflowSegments: n > T5_LIMIT ? [0] : []
      };
    }

    var n2 = rawCount(text);
    return { total: n2, segments: 1, segmentCounts: [n2], limit: null, overflowSegments: [] };
  }

  /**
   * 载入 CLIP 词表（调用方 fetch 后转交；本方法只组装）。
   * @param {Object} vocab vocab.json 解析结果（{token: id}）
   * @param {string} mergesText merges.txt 原文（首行 # 版本注释自动跳过）
   * @returns {{type:"clip", encoder:Object, merges:string[]}}
   */
  function loadClipTable(vocab, mergesText) {
    var merges = String(mergesText == null ? "" : mergesText).split(/\r?\n/)
      .filter(function (l) { return l && l.charAt(0) !== "#"; });
    return { type: "clip", encoder: vocab, merges: merges };
  }

  /**
   * 载入 tiktoken 词表（.tiktoken 文本：每行 "base64(字节) rank"）。
   * 键按 bytesToUnicode 映射，与 tiktokenTokens 的查表方式一致。
   * @param {string} raw
   * @returns {{type:"tiktoken", ranks:Object}}
   */
  function loadTiktokenTable(raw) {
    var ranks = {};
    var b2u = bytesToUnicode();
    String(raw == null ? "" : raw).split(/\r?\n/).forEach(function (line) {
      if (!line) return;
      var sp = line.lastIndexOf(" ");
      if (sp <= 0) return;
      var rank = parseInt(line.slice(sp + 1), 10);
      if (isNaN(rank)) return;
      var b64 = line.slice(0, sp);
      var bytes;
      try {
        var bin = (typeof atob === "function") ? atob(b64) : null;
        if (bin == null) return;
        bytes = [];
        for (var i2 = 0; i2 < bin.length; i2++) bytes.push(bin.charCodeAt(i2));
      } catch (e) { return; }
      var key = "";
      for (var k = 0; k < bytes.length; k++) key += b2u[bytes[k]];
      ranks[key] = rank;
    });
    return { type: "tiktoken", ranks: ranks };
  }

  return {
    parseWeighted: parseWeighted,
    bandOf: bandOf,
    splitPositiveNegative: splitPositiveNegative,
    buildNegative: buildNegative,
    countTokens: countTokens,
    loadClipTable: loadClipTable,
    loadTiktokenTable: loadTiktokenTable
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PromptLib;
}
