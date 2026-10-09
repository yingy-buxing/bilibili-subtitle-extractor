(function (root) {
  'use strict';
  function normalize(raw) {
    const data = raw && Array.isArray(raw.body) ? raw : raw?.data;
    if (!data || !Array.isArray(data.body) || !data.body.length) throw new Error('没有找到非空字幕 body。');
    const cues = data.body.map((x, i) => {
      if (!x || typeof x.content !== 'string' || !Number.isFinite(x.from) || !Number.isFinite(x.to) || x.from < 0 || x.to < x.from) throw new Error(`第 ${i + 1} 条字幕的文字或时间轴无效。`);
      return { from: x.from, to: x.to, content: x.content };
    });
    for (let i = 1; i < cues.length; i++) if (cues[i].from < cues[i - 1].from) throw new Error('字幕时间轴未按顺序排列，请检查原始文件。');
    return { data, cues, language: typeof data.lang === 'string' ? data.lang : '未标注语言' };
  }
  function decode(text, encoding) {
    if (encoding !== 'base64') return text;
    const binary = typeof atob === 'function' ? atob(text) : Buffer.from(text, 'base64').toString('binary');
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
  }
  function parse(text, filename = '字幕') {
    let raw;
    try { raw = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('文件不是有效的 JSON/HAR，请使用 Chrome 导出的 HAR 或字幕 JSON。'); }
    if (!raw?.log?.entries) return { tracks: [{ ...normalize(raw), name: filename.replace(/\.(json|har)$/i, '') }], warnings: [] };
    if (!Array.isArray(raw.log.entries)) throw new Error('HAR 的请求列表格式无效。');
    const tracks = [], warnings = [], seen = new Set();
    for (const e of raw.log.entries) {
      const c = e?.response?.content;
      if (typeof c?.text !== 'string' || !c.text) continue;
      let subtitleRequest = false;
      try { const u = new URL(e.request?.url); subtitleRequest = /(^|\.)(hdslb\.com|bilibili\.com)$/.test(u.hostname) && /subtitle/i.test(u.hostname + u.pathname); } catch {}
      try {
        const payload = JSON.parse(decode(c.text, c.encoding));
        if (!Array.isArray(payload?.body) && !Array.isArray(payload?.data?.body)) continue;
        const track = normalize(payload), key = JSON.stringify(track.cues);
        if (seen.has(key)) continue;
        seen.add(key);
        tracks.push({ ...track, name: `${filename.replace(/\.har$/i, '')}-${track.language}-${tracks.length + 1}` });
      } catch (err) { if (subtitleRequest) warnings.push('一个字幕候选响应无法解析：' + err.message); }
    }
    if (!tracks.length) throw new Error('HAR 中没有完整字幕正文。请先选择视频的“中文”字幕，再筛选 ai_subtitle 并导出 HAR；只有字幕列表接口或缺少响应正文的 HAR 无法转换。');
    return { tracks, warnings };
  }
  function stamp(t) {
    let n = Math.round(t * 1000), ms = n % 1000; n = Math.floor(n / 1000);
    const s = n % 60; n = Math.floor(n / 60); const m = n % 60, h = Math.floor(n / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }
  function render(track, format) {
    if (format === 'json') return JSON.stringify(track.data, null, 2) + '\n';
    if (format === 'txt') return track.cues.map(c => c.content).join('\n') + '\n';
    if (format === 'srt') return track.cues.map((c, i) => `${i + 1}\n${stamp(c.from)} --> ${stamp(c.to)}\n${c.content}`).join('\n\n') + '\n';
    throw new Error('不支持的导出格式。');
  }
  function safeName(name) { return (name || '字幕').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim().replace(/[. ]+$/, '').slice(0, 120) || '字幕'; }
  const api = { normalize, parse, render, stamp, safeName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SubtitleCore = api;
})(globalThis);
