/* 在当前B站页面运行。浏览器自动携带既有登录状态；不读取或返回Cookie。 */
async function extractCurrentBiliPage() {
  const match = location.pathname.match(/\/video\/(BV[0-9A-Za-z]{10})(?:\/|$)/);
  if (location.hostname !== 'www.bilibili.com' || !match) return { error: '请先打开 www.bilibili.com 的B站视频页，再点击插件。' };
  const bvid = match[1], part = Number(new URL(location.href).searchParams.get('p') || 1);
  async function get(url, authenticated) {
    const r = await fetch(url, { credentials: authenticated ? 'include' : 'omit', signal: AbortSignal.timeout(25000) });
    if (!r.ok) throw new Error('B站请求失败（HTTP ' + r.status + '），请稍后重试。');
    return r.json();
  }
  try {
    const view = await get('https://api.bilibili.com/x/web-interface/view?' + new URLSearchParams({ bvid }), true);
    if (view.code !== 0) throw new Error('未能读取视频信息，请确认当前视频可播放。');
    const page = view.data.pages?.[part - 1];
    if (!page || !Number.isInteger(part) || part < 1) throw new Error('没有找到当前分P。');
    const player = await get('https://api.bilibili.com/x/player/wbi/v2?' + new URLSearchParams({ aid: view.data.aid, cid: page.cid }), true);
    if (player.code !== 0) throw new Error('B站没有返回字幕信息（代码 ' + player.code + '），请刷新视频后重试。');
    const subtitles = player.data?.subtitle?.subtitles || [];
    if (!subtitles.length) return { error: '当前页面的登录状态已随请求使用，但B站未返回字幕。请先在播放器的“翻译和字幕”中开启中文，再点击提取；若仍无结果，可能是接口未提供此字幕。' };
    const tracks = [], warnings = [];
    for (const sub of subtitles) {
      try {
        const u = new URL(sub.subtitle_url, 'https://www.bilibili.com');
        if (u.protocol !== 'https:' || !/(^|\.)hdslb\.com$/.test(u.hostname)) throw new Error('字幕地址格式不受支持。');
        const raw = await get(u.href, false);
        if (!Array.isArray(raw.body) || !raw.body.length) throw new Error('字幕正文为空。');
        // 只将字幕时间轴和文本带回插件，不包含登录信息和请求地址。
        const data = { body: raw.body.map(c => ({ from: c.from, to: c.to, content: c.content })) };
        tracks.push({ data, language: sub.lan_doc || sub.lan || '字幕', name: view.data.title + (view.data.pages.length > 1 ? '-P' + part : '') });
      } catch (e) { warnings.push((sub.lan_doc || sub.lan || '字幕') + '：' + e.message); }
    }
    if (!tracks.length) throw new Error(warnings.join('\n') || '没有取得完整字幕。');
    return { title: view.data.title, bvid, tracks, warnings };
  } catch (e) { return { error: e.name === 'TimeoutError' ? '请求超时，请重试。' : e.message }; }
}
if (typeof module !== 'undefined' && module.exports) module.exports = extractCurrentBiliPage;
