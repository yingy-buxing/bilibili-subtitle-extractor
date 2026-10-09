'use strict';
const el = id => document.getElementById(id);
let tracks = [], selected = null;
function message(text, error = false) { el('status').textContent = text; el('status').className = error ? 'error' : ''; }
function show(next, warnings = []) {
  tracks = next;
  el('tracks').replaceChildren();
  next.forEach((t, i) => { const option = document.createElement('option'); option.value = i; option.textContent = `${t.language} · ${t.cues.length} 条 · ${t.name}`; el('tracks').append(option); });
  el('result').hidden = false;
  choose();
  message(`已找到 ${next.length} 条字幕轨道。${warnings.length ? ' ' + warnings.join(' ') : ''}`);
}
function choose() {
  selected = tracks[Number(el('tracks').value)];
  if (!selected) return;
  el('name').value = SubtitleCore.safeName(selected.name);
  const first = selected.cues[0], last = selected.cues.at(-1);
  el('stats').textContent = `${selected.cues.length} 条字幕 · ${selected.cues.reduce((n, c) => n + c.content.length, 0).toLocaleString()} 字符 · ${SubtitleCore.stamp(first.from)} — ${SubtitleCore.stamp(last.to)}`;
  el('preview').textContent = selected.cues.slice(0, 30).map(c => `[${SubtitleCore.stamp(c.from)}] ${c.content}`).join('\n');
  el('tail').textContent = '末条字幕：' + last.content;
}
async function importFile(file) {
  if (!file) return;
  tracks = []; selected = null; el('result').hidden = true;
  if (file.size > 100 * 1024 * 1024) return message('文件超过100 MB。请在 Network 中筛选 ai_subtitle 后重新导出，避免包含整段视频。', true);
  message('正在本地读取…');
  try { const r = SubtitleCore.parse(await file.text(), file.name); show(r.tracks, r.warnings); }
  catch (err) { message(err.message, true); }
  finally { el('file').value = ''; }
}
el('file').addEventListener('change', e => importFile(e.target.files[0]));
el('tracks').addEventListener('change', choose);
el('drop').addEventListener('dragover', e => { e.preventDefault(); el('drop').classList.add('active'); });
el('drop').addEventListener('dragleave', () => el('drop').classList.remove('active'));
el('drop').addEventListener('drop', e => { e.preventDefault(); el('drop').classList.remove('active'); importFile(e.dataTransfer.files[0]); });
document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => {
  if (!selected) return;
  const format = button.dataset.format;
  const blob = new Blob([SubtitleCore.render(selected, format)], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = SubtitleCore.safeName(el('name').value) + '.' + format;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  message('已请求保存 ' + format.toUpperCase() + ' 文件，请查看浏览器下载记录。');
}));
if (typeof chrome !== 'undefined' && chrome.devtools?.network) {
  el('capture').hidden = false;
  const found = [], seenCapture = new Set();
  function capture(request) {
    let url;
    try { url = new URL(request.request.url); } catch { return; }
    if (!/(^|\.)(hdslb\.com|bilibili\.com)$/.test(url.hostname) || !/subtitle/i.test(url.hostname + url.pathname) || /\/x\/v2\/subtitle\//.test(url.pathname)) return;
    request.getContent((content, encoding) => {
      if (!content) return;
      try {
        const entry = { request: { url: url.href }, response: { content: { text: content, encoding } } };
        const r = SubtitleCore.parse(JSON.stringify({ log: { entries: [entry] } }), 'B站字幕');
        for (const t of r.tracks) {
          const key = JSON.stringify(t.cues);
          if (!seenCapture.has(key)) { seenCapture.add(key); found.push(t); }
        }
        if (found.length) show(found);
      } catch { /* 字幕元数据、尚未完成的响应不视为字幕正文 */ }
    });
  }
  chrome.devtools.network.onRequestFinished.addListener(capture);
  chrome.devtools.network.getHAR(har => har.entries.forEach(capture));
  el('clear').addEventListener('click', () => { found.length = 0; seenCapture.clear(); tracks = []; selected = null; el('result').hidden = true; message('已清空。请在视频页切换字幕，必要时刷新视频页。'); });
}
