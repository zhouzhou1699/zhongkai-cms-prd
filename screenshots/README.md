# 附录 · 截图说明

所有截图来自真实运行中的系统（本地 127.0.0.1:8901 静态服务 / 后台 6993），非设计稿。

## 官网（前台）

| 文件 | 页面 | 看点 |
|---|---|---|
| [site-index.png](site-index.png) | 服务官网首页 | 首屏 + 数据条（5 省 / 1,929 席位 / 58 院校 / 29 企业）+ 资讯区 + 解决方案 |
| [site-index-mobile.png](site-index-mobile.png) | 首页移动端 | 390 宽无横向溢出 |
| [site-products.png](site-products.png) | 产品超市 | 软件 / 硬件分区；15 款产品卡片 |
| [site-product-annotation.png](site-product-annotation.png) | 产品详情（标注平台） | 能力卡 4 张 + 规格表 6 行 + 相关产品 |
| [site-solutions.png](site-solutions.png) | 解决方案 | 4 个方案块 |
| [site-training.png](site-training.png) | 校企实训 | 3 个板块（专业建设 / 园区就业 / 客户服务） |
| [site-data-factory.png](site-data-factory.png) | 数据工厂 | 采集→清洗→标注→审核→训练→交付 |
| [site-service-about.png](site-service-about.png) | 关于中开服务 | 公司速览条 + 正文 |
| [site-group.png](site-group.png) | 集团官网首页 | 与服务站差异化定位 |
| [site-group-bases.png](site-group-bases.png) | 园区基地 | 7 个基地按省分组 |
| [site-group-news.png](site-group-news.png) | 中开资讯 | 政策 / 科普 / 集团动态 |
| [site-contact.png](site-contact.png) | 联系我们 | **注意：提交按钮没有绑定逻辑（已知缺陷 F-17）** |

## 后台（运营端）

| 文件 | 界面 | 看点 |
|---|---|---|
| [01-login.png](01-login.png) | 登录 | 账号 + 密码，错误锁定提示 |
| [03-home-service.png](03-home-service.png) | 首页编辑 | 面包屑 + 文件名 + 字段化编辑（「首屏主标语」而非 `hero_title`） |
| [04-search.png](04-search.png) | 全站搜索 | 搜「电话」直接跳到字段 |
| [05-preview.png](05-preview.png) | 未发布预览 | 整站预览 + 「预览」角标，线上零字节变动 |
| [07-backups.png](07-backups.png) | 备份与恢复 | 只回页面 / 页面 + 内容 |
| [09-audit.png](09-audit.png) | 操作日志 | 时间 / 账号 / IP / 动作 |
| [12-history-diff.png](12-history-diff.png) | 字段级差异 | 左旧右新 |
| [14-publish-done.png](14-publish-done.png) | 发布完成 | 逐页结果 + 耗时 |
| [17-conflict.png](17-conflict.png) | 保存冲突 | 409 + 字段差异 + 强制覆盖 |
| [20-upload-compressed.png](20-upload-compressed.png) | 图片上传 | 浏览器端压缩，提示省了多少 |

## 原型

| 文件 | 说明 |
|---|---|
| [proto-main.png](proto-main.png) | 可点原型主界面：IA 树 + 字段编辑器 + 发布状态机 |
| [proto-product.png](proto-product.png) | 产品详情页的 5 个字段（真实内容） |
| [proto-fail.png](proto-fail.png) | 发布失败 + 自动回滚的提示形态 |
| [proto-publish.png](proto-publish.png) | 发布状态机初始态 |
