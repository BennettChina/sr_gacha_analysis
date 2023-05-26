<div style="width:200px;height:200px;overflow:hidden;border-radius:50%;margin: 50px auto 20px;">
    <img src="https://source.hibennett.cn/upic/CvANUM1685098381610.png" alt="avatar/logo" style="width:auto;height:auto;">
</div>
<div align="center">
    <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/BennettChina/sr_gacha_analysis">
    <a target="_blank" href="https://raw.githubusercontent.com/BennettChina/sr_gacha_analysis/master/LICENSE">
		<img alt="Repo License" src="https://img.shields.io/github/license/BennettChina/sr_gacha_analysis">
	</a>
    <a target="_blank" href='https://github.com/BennettChina/sr_gacha_analysis/stargazers'>
		<img src="https://img.shields.io/github/stars/BennettChina/sr_gacha_analysis.svg?logo=github" alt="github star"/>
	</a>
</div>

<h1 align="center">星铁抽卡分析插件</h1>

## 🧑‍💻简介

**星铁抽卡分析插件** 为 [Adachi-BOT](https://github.com/SilveryStar/Adachi-BOT)
衍生插件，用于对 [崩坏星穹铁道](https://sr.mihoyo.com/)
这款游戏中的抽卡数据进行分析制图，并存储用户的这部分数据，可随时将数据导入导出以及删除。

- [x] 😜 使用链接分析生成饼图
- [x] 🥳 历史记录分析
- [x] 🎉 [SRGF标准](https://uigf.org/zh/standards/SRGF.html)导入功能
- [x] ✨ [SRGF标准](https://uigf.org/zh/standards/SRGF.html)导出功能
- [x] 🤪 删除记录功能
- [ ] 📆 分析生成头像式图片 (缺个UI的设计)
- [ ] 🧐 使用Cookie生成链接分析 (大概需要抓包米游社星铁客服页面`genAuthKey`
  接口看看跟原神的有什么不同，作者现在无可抓包设备)

## 🛠️ 安装方式

在 `Adachi-BOT/src/plugins` 目录执行下面的命令。

```shell
git clone https://ghproxy.com/https://github.com/BennettChina/sr_gacha_analysis.git
```

## 🎁 更新方式

### 💻 命令行更新

在插件目录执行下面的命令即可。

```shell
git pull
```

### 📱 指令更新

可使用 `#upgrade_plugins srga` 指令来更新本插件。

## 🧰 指令列表

| 指令名         | 参数                   | 描述                     |
|-------------|----------------------|------------------------|
| `#星铁抽卡分析`   | `链接`                 | 指定链接生成饼图               |
| `#星铁历史记录分析` | 无                    | 用存储的历史数据生成饼图           |
| `星铁导出`      | `json、excel、url`     | 导出 excel 表或 JSON 或 URL |
| `星铁导入`      | `json、excel、文件的URL ` | 导入记录                   |
| `清除星铁记录`    | 无                    | 清除上次统计用的uid            |

## ⚙️ 配置文件

```yaml
tips: |
    accessKey和secretKey是七牛云的两个密钥AK、SK
    bucket是你创建的空间名
    domain是你文件访问的域名（带协议头，如：https://sources.demo.com/）
    folder是文件上传后的目录，比如:bot/gacha_export
    uses3是否使用AWS S3功能（与七牛云正常上传二选一，S3可以实现将文件存储在其他OSS）
    s3endpoint是你OSS的地区域名
    s3region是OSS所在区域，一般是s3endpoint的第三级域名（七牛云的不同需要将第三级域名中的s3-去掉）
qiniuOss:
    enable: false
    accessKey: ""
    secretKey: ""
    bucket: ""
    domain: ""
    folder: ""
    uses3: false
    s3endpoint: ""
    s3region: ""
# 是否将上传至七牛云的链接转为二维码
qrcode: false
# 指令更新时使用的别名
aliases:
    - 星铁抽卡分析
    - srga 
```
