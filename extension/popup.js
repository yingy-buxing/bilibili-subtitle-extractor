'use strict';
const $ = id => document.getElementById(id);
let tracks = [];
function showTrack() {
  const t = tracks[Number($('track').value)];
  if (!t) return;
  $('name').value = t.name;
  $('stats').textContent = `${t.cues.length} 条字幕 · ${t.cues.reduce((n,c) => n + c.content.length,0).toLocaleString()} 字符`;
  $('preview').textContent = t.cues.slice(0,10).map(c => c.content).join('\n');
}
$('extract').onclick = async () => {
  $('extract').disabled = true;
  $('result').hidden = true;
  $('status').textContent = '正在读取当前视频字幕…提取完成前请保持窗口打开。';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/www\.bilibili\.com\/video\/BV[0-9A-Za-z]{10}(?:[/?#]|$)/.test(tab.url || '')) throw new Error('请先打开B站视频页，再点击插件。');
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: extractCurrentBiliPage });
    const result = results[0]?.result;
    if (!result || result.error) throw new Error(result?.error || '页面未返回结果，请刷新后重试。');
    tracks = result.tracks.map(t => ({ ...SubtitleCore.normalize(t.data), language: t.language, name: t.name }));
    $('title').textContent = result.title;
    $('track').replaceChildren(...tracks.map((t,i) => {
      const option = document.createElement('option'); option.value = i; option.textContent = t.language; return option;
    }));
    $('result').hidden = false; showTrack();
    $('status').textContent = '已提取，可直接下载。' + (result.warnings.length ? '\n' + result.warnings.join('\n') : '');
  } catch (e) { $('status').textContent = e.message; }
  finally { $('extract').disabled = false; }
};
$('track').onchange = showTrack;
document.querySelectorAll('[data-format]').forEach(button => button.onclick = () => {
  const t = tracks[Number($('track').value)]; if (!t) return;
  const format = button.dataset.format, blob = new Blob([SubtitleCore.render(t,format)], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = SubtitleCore.safeName($('name').value) + '.' + format; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  $('status').textContent = '已请求下载，请查看Chrome下载记录。';
});
