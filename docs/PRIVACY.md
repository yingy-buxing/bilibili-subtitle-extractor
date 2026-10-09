# 权限与数据处理

## 扩展请求的权限

| 配置 | 用途 |
| --- | --- |
| `activeTab` | 点击插件时取得当前标签页的临时访问能力 |
| `scripting` | 在当前B站视频页运行字幕提取函数 |
| `devtools_page` | 提供备用开发者工具面板，读取被检查页面的字幕响应 |

没有请求所有网站访问权限、`cookies`、浏览历史、账户密码、麦克风、摄像头或本地文件系统权限。下载通过浏览器普通文件下载完成，没有申请 `downloads` 权限。

`activeTab` 和 `scripting` 本身是浏览器提供的页面访问能力；本项目代码在执行前检查当前标签页是否为支持的B站视频URL，在提取函数中再次检查页面域名和BV号。

## 登录状态

主流程在页面的主执行环境（`world: MAIN`）发起访问B站API的网络请求，设置 `credentials: include`，由浏览器自动带上正常的B站登录状态。插件代码没有读取Cookie字符串，也没有把登录凭据传回插件或保存到文件。

字幕CDN请求设置 `credentials: omit`，并校验地址为HTTPS和 `hdslb.com` 域名。

## 网络访问

主流程使用：

- `api.bilibili.com/x/web-interface/view`：视频标题与分P信息。
- `api.bilibili.com/x/player/wbi/v2`：可用字幕轨道。
- 接口返回的HTTPS `hdslb.com` 字幕地址：字幕正文。

请求只发往B站相关服务。没有项目自建服务器、第三方统计、远程代码加载或云端转写服务。

## 数据保存

字幕结果暂存在插件弹窗内存中，供预览与导出；不使用 `chrome.storage`、`localStorage` 或其他持久存储保存结果。关闭弹窗后需重新提取。用户点击下载后，导出文件保存在Chrome下载位置。

主流程导出JSON仅包含字幕 `body` 数组中的 `from`、`to`、`content`。TXT和SRT分别保存原文及时间轴，不包含请求头、账号凭据或带签名的字幕URL。

## 备用开发者工具面板

面板可接触当前被检查页面的网络记录，代码会筛选B站相关的字幕候选请求，读取响应正文，再在本地解析。手动导入的HAR可能包含其他请求数据；不要将完整HAR公开上传。导出字幕不会复制HAR网络请求头或Cookie。

## 开源检查

完整运行代码在 `extension/` 内，无需构建。可重点检查 `manifest.json`、`page-extract.js`、`popup.js`、`app.js` 和 `core.js`。
