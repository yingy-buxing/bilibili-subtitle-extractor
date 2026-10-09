'use strict';
const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/../extension/page-extract.js','utf8');
async function run(responses, path='/video/BV1BoM76iEih/', search='?p=2') {
 const calls=[];const context={URL,URLSearchParams,AbortSignal,location:{hostname:'www.bilibili.com',pathname:path,href:'https://www.bilibili.com'+path+search},fetch:async(url,opts)=>{calls.push({url,opts});const x=responses.shift();if(x instanceof Error)throw x;return{ok:true,json:async()=>x}}};
 vm.createContext(context);vm.runInContext(source,context);const result=await context.extractCurrentBiliPage();return{result,calls};
}
(async()=>{
 const info={code:0,data:{title:'课程',aid:1,pages:[{cid:2},{cid:3}]}};
 const sub={code:0,data:{subtitle:{subtitles:[{lan_doc:'中文',subtitle_url:'//aisubtitle.hdslb.com/a.json'}]}}};
 const payload={body:[{from:0.2,to:1.5,content:'字幕原文'}],irrelevant:'should not return'};
 let {result,calls}=await run([info,sub,payload]);
 assert.equal(result.tracks[0].data.body[0].content,'字幕原文');
 assert.equal(result.tracks[0].data.irrelevant,undefined);
 assert.match(calls[1].url,/cid=3/);assert.equal(calls[0].opts.credentials,'include');assert.equal(calls[1].opts.credentials,'include');assert.equal(calls[2].opts.credentials,'omit');
 console.log('通过：当前分P、现有登录状态、字幕CDN不带Cookie、仅返回字幕');
 ({result}=await run([info,{code:0,data:{subtitle:{subtitles:[]}}}]));assert.match(result.error,/未返回字幕/);console.log('通过：空字幕提示');
 ({result}=await run([info,{code:-403}]));assert.match(result.error,/-403/);console.log('通过：平台错误提示');
 ({result,calls}=await run([info,{code:0,data:{subtitle:{subtitles:[{subtitle_url:'https://evil.test/x'}]}}}]));assert.ok(result.error);assert.equal(calls.length,2);console.log('通过：拒绝非字幕CDN地址');
 ({result,calls}=await run([],'/'));assert.match(result.error,/视频页/);assert.equal(calls.length,0);console.log('通过：拒绝非视频页');
 ({result}=await run([new TypeError('网络错误')]));assert.equal(result.error,'网络错误');console.log('通过：网络错误提示');
})().catch(e=>{console.error(e);process.exitCode=1});
