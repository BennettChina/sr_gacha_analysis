## 2.0.3 （2023-12-17）

- fix: 修复渲染函数未定义报错。

## 2.0.2 （2023-12-17）

- fix: 抽卡分析链接解析失败的问题。

## 2.0.1 （2023-12-13）

- 暂时移除导出记录直接发送文件的功能，仅支持上传至 OSS 中。

## 2.0.0（2023-10-28）

- 适配主项目 `3.x` 版本。
- 受限目前仅支持了 `go-cqhttp` ，而其尚未支持 [OneBot-V12](https://onebot.dev)，故暂不支持 `2.x`
  中提供的引用文件消息从而导入记录的方式，仅支持发送文件链接的方式导入。

## 1.0.3（2023-10-08）

- 修复平均出货次数保留小数的 bug ；
- 修复刷新配置后不支持热更新的 bug 。

## 1.0.2（2023-06-01）

- 修复不能使用缓存链接分析的问题；
- 修复返回链接错误依旧分析历史数据的问题。

## 1.0.1（2023-05-30）

- 修复未使用过链接的抽卡分析的情况下使用导入功能，再使用历史分析无法使用的问题。
- 完善 `README` 文档的描述。

## 1.0.0（2023-05-26）

- 完成插件的基本功能