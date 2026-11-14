# 数据说明

本目录的数字全部来自真实系统导出，可用 `scripts/` 里的脚本复跑。

| 文件 | 内容 | 生成方式 |
|---|---|---|
| `pages.json` | 41 个页面的文件名与 `<title>` | `scripts/dump_content_model.py` |
| `fields.json` | 218 个字段的字典（页面 / 路径 / 中文 label / 类型 / 所属站） | 同上 |
| `products.json` | 15 个产品的注册表（slug / 名称 / 角标 / 类型） | 同上 |
| `bases.json` | 7 个基地的注册表（名称 / 省份 / 标签 / 简介） | 同上 |
| `prototype-tree.json` | 原型用的页面树 + 字段 + 样例值 | 同上 |
| `sample-content.json` | 完整的 content.json 真实样例（145 KB，可用于理解 schema） | 直接复制 |
| `metrics-code.json` | 代码行数、页面体积、字段类型分布、提交数 | `scripts/collect_metrics.py` |
| `metrics-build.json` | 构建性能基准（全量 / 单页 / Python 启动成本） | `scripts/bench_build.py` |

## 关键数字（当前）

```json
{
  "pages": 41,
  "fields_total": 218,
  "field_types": 13,
  "products": 15,
  "bases": 7,
  "commits": 57,
  "code_total": 11609,
  "avg_page_bytes": 23472,
  "max_page": "index.html 59508",
  "css_bytes": 235731,
  "full_build_s": 0.223,
  "single_page_s": 0.072,
  "per_page_ms_avg": 4.0
}
```

## 复跑方式

```bash
# 需要有 company/ 源码（真实系统）
python scripts/dump_content_model.py --src ../company
python scripts/collect_metrics.py   --src ../company
python scripts/bench_build.py       --src ../company   # 在临时目录构建，不污染真实站点
python scripts/build_prototype.py                      # 重建 prototype/index.html
```

## 口径说明（避免误读）

| 说法 | 准确含义 |
|---|---|
| 「41 页」 | 站点根目录 `*.html` 总数，含登录页与后台手册页；对外页面 39 个 |
| 「218 字段」 | content.json 里带 `label` 的字段节点数；数组内的每个元素不重复计入 |
| 「全量 0.22 s」 | 单进程内构建 40 个目标（41 页 + 3 个产品独立站，部分页复用），本机实测 |
| 「单页 0.07 s」 | 含进程内 import 已完成的条件下，只构建 1 页；此数字**小于**启动一次 Python 的 0.20 s |
| 「4.5 s → 0.22 s」 | 旧方案 6 个 `subprocess` 串行跑生成器 vs 新方案单进程页级构建 |
| 「118 项自动化断言」 | 57 接口 + 24 界面 + 9 布局 + 16 回滚 + 12 冲突/角色 |
