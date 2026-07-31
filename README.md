# Zcy WorkBench · 我的日程台

一个本地优先的个人工作台，包含今日工作、官微、报销、会议与社交备忘、考勤、项目、提醒、广播音乐和灵感碎片等模块。

## 本地使用

需要 Node.js 22 或更高版本。安装依赖后，Windows 用户双击 `启动日程台.cmd` 即可打开：

```bash
pnpm install
```

默认地址为 [http://localhost:777/zcyworkbench/](http://localhost:777/zcyworkbench/)。启动器会同时运行网页和本地资料服务。

## 在线访问

工作台部署在个人主页的子路径：

[https://djangomei.com/zcyworkbench/](https://djangomei.com/zcyworkbench/)

在线访问时，日程与项目等内容仅保存在当前浏览器，不会公开上传到网站服务器；本地启动时仍使用 `个人资料库/`。

## 数据与隐私

全部个人资料只保存在本机的 `个人资料库/`：

- `data.json` 保存日程、项目、广播音乐、提醒、生日与灵感。
- `灵感图片/` 保存上传到灵感碎片的图片。
- `导出/` 保存 AI 友好的 JSON 与 Markdown 导出文件。
- `三日备份/` 保存删除发生前的完整快照，并自动保留 72 小时。

`个人资料库/`、运行日志和临时图片已加入 `.gitignore`，不会上传到 GitHub。

## 验证

```bash
pnpm test
```
