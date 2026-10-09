'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../extension/core.js');
const raw = { lang: 'zh-CN', body: [{ from: 0.24, to: 1.06, content: '时隔一年' }, { from: 3599.9996, to: 3601.01, content: '<script>测试</script>' }] };
let count = 0;
function test(name, fn) { fn(); count++; console.log('通过：' + name); }
const entry = (data, base64 = false) => ({ request: { url: 'https://aisubtitle.hdslb.com/bfs/ai_subtitle/prod/example?auth_key=synthetic-test-value' }, response: { content: { text: base64 ? Buffer.from(JSON.stringify(data)).toString('base64') : JSON.stringify(data), ...(base64 ? { encoding: 'base64' } : {}) } } });
test('JSON和嵌套JSON', () => { assert.equal(core.parse(JSON.stringify(raw)).tracks[0].cues.length, 2); assert.equal(core.parse(JSON.stringify({ data: raw })).tracks.length, 1); });
test('明文和Base64 HAR重复去重', () => assert.equal(core.parse(JSON.stringify({ log: { entries: [entry(raw), entry(raw, true)] } })).tracks.length, 1));
test('多语言轨道', () => assert.equal(core.parse(JSON.stringify({ log: { entries: [entry(raw), entry({ ...raw, lang: 'en', body: [{ from: 0, to: 1, content: 'Hello' }] })] } })).tracks.length, 2));
test('空HAR和只有元数据', () => { assert.throws(() => core.parse('{"log":{"entries":[]}}'), /没有完整字幕/); assert.throws(() => core.parse(JSON.stringify({ log: { entries: [entry({ subtitles: [] })] } })), /没有完整字幕/); });
test('无效时间轴拒绝', () => { assert.throws(() => core.normalize({ body: [{ from: -1, to: 2, content: '错' }] })); assert.throws(() => core.normalize({ body: [{ from: 2, to: 1, content: '错' }] })); assert.throws(() => core.normalize({ body: [{ from: 2, to: 3, content: '错' }, { from: 1, to: 2, content: '错' }] })); });
test('时间进位与原文保留', () => { assert.equal(core.stamp(3599.9996), '01:00:00,000'); const track = core.normalize(raw); assert.match(core.render(track, 'srt'), /00:00:00,240 --> 00:00:01,060/); assert.equal(core.render(track, 'txt'), '时隔一年\n<script>测试</script>\n'); });
test('输出JSON不携带HAR凭据', () => { const t = core.parse(JSON.stringify({ log: { entries: [entry(raw)] } })).tracks[0]; assert.deepEqual(JSON.parse(core.render(t, 'json')), raw); assert.ok(!core.render(t, 'json').includes('auth_key')); });
test('文件名清理', () => assert.equal(core.safeName('../坏:名字'), '.._坏_名字'));
test('扩展已有请求、实时捕获、去重与清空', () => {
  const nodes = new Map();
  function element() { return { hidden: true, value: '0', textContent: '', className: '', dataset: {}, children: [], handlers: {}, replaceChildren() { this.children = []; this.value = '0'; }, append(x) { this.children.push(x); }, addEventListener(k, fn) { this.handlers[k] = fn; }, classList: { add() {}, remove() {} } }; }
  const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const request = { ...entry(raw), getContent(fn) { fn(JSON.stringify(raw), ''); } }; let listener;
  const ctx = { SubtitleCore: core, document: { getElementById: get, querySelectorAll: () => [], createElement: element }, chrome: { devtools: { network: { onRequestFinished: { addListener(fn) { listener = fn; } }, getHAR(fn) { fn({ entries: [request] }); } } } }, URL, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../extension/app.js'), 'utf8'), ctx);
  assert.equal(get('capture').hidden, false); assert.equal(get('tracks').children.length, 1); assert.equal(get('result').hidden, false);
  listener(request); assert.equal(get('tracks').children.length, 1);
  get('clear').handlers.click(); assert.equal(get('result').hidden, true); listener(request); assert.equal(get('result').hidden, false);
});
console.log(`共 ${count} 项检查通过。`);
